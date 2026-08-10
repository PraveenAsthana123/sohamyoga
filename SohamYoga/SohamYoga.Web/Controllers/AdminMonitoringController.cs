using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Data;

namespace SohamYoga.Web.Controllers;

/// <summary>
/// Admin-only endpoints for system monitoring: API request stats, audit logs,
/// system health metrics, and application log viewer.
/// </summary>
[ApiController]
[Route("api/admin/monitoring")]
[Authorize(Roles = "Admin")]
public class AdminMonitoringController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<AdminMonitoringController> _logger;

    public AdminMonitoringController(ApplicationDbContext db, ILogger<AdminMonitoringController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// GET /api/admin/monitoring/api-requests — Paginated API request logs.
    /// </summary>
    [HttpGet("api-requests")]
    public async Task<IActionResult> GetApiRequests(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? method = null,
        [FromQuery] int? statusCode = null,
        [FromQuery] string? path = null)
    {
        var query = _db.ApiRequestLogs.AsQueryable();

        if (!string.IsNullOrWhiteSpace(method))
            query = query.Where(r => r.Method == method.ToUpper());

        if (statusCode.HasValue)
            query = query.Where(r => r.StatusCode == statusCode.Value);

        if (!string.IsNullOrWhiteSpace(path))
            query = query.Where(r => r.Path.Contains(path));

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new
            {
                r.Id,
                r.Method,
                r.Path,
                r.StatusCode,
                r.DurationMs,
                r.ClientIp,
                r.UserId,
                r.CorrelationId,
                r.CreatedAt
            })
            .ToListAsync();

        return Ok(new { items, total, page, pageSize });
    }

    /// <summary>
    /// GET /api/admin/monitoring/api-requests/stats — Aggregate API performance metrics.
    /// </summary>
    [HttpGet("api-requests/stats")]
    public async Task<IActionResult> GetApiRequestStats()
    {
        var since24h = DateTime.UtcNow.AddHours(-24);
        var recentRequests = _db.ApiRequestLogs.Where(r => r.CreatedAt >= since24h);

        var totalRequests = await recentRequests.CountAsync();
        var avgDuration = totalRequests > 0
            ? await recentRequests.AverageAsync(r => (double)r.DurationMs)
            : 0;
        var errorCount = await recentRequests.CountAsync(r => r.StatusCode >= 400);
        var errorRate = totalRequests > 0 ? (double)errorCount / totalRequests * 100 : 0;

        var topEndpoints = await recentRequests
            .GroupBy(r => new { r.Method, r.Path })
            .Select(g => new
            {
                g.Key.Method,
                g.Key.Path,
                Count = g.Count(),
                AvgDurationMs = g.Average(r => (double)r.DurationMs)
            })
            .OrderByDescending(e => e.Count)
            .Take(10)
            .ToListAsync();

        var statusDistribution = await recentRequests
            .GroupBy(r => r.StatusCode)
            .Select(g => new { StatusCode = g.Key, Count = g.Count() })
            .OrderBy(s => s.StatusCode)
            .ToListAsync();

        return Ok(new
        {
            totalRequests,
            avgDurationMs = Math.Round(avgDuration, 2),
            errorCount,
            errorRate = Math.Round(errorRate, 2),
            topEndpoints,
            statusDistribution,
            period = "last_24_hours"
        });
    }

    /// <summary>
    /// GET /api/admin/monitoring/audit-logs — Paginated audit trail.
    /// </summary>
    [HttpGet("audit-logs")]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? action = null,
        [FromQuery] string? entityType = null,
        [FromQuery] string? userId = null)
    {
        var query = _db.AuditLogs.AsQueryable();

        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(a => a.Action == action);

        if (!string.IsNullOrWhiteSpace(entityType))
            query = query.Where(a => a.EntityType == entityType);

        if (!string.IsNullOrWhiteSpace(userId))
            query = query.Where(a => a.UserId == userId);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new { items, total, page, pageSize });
    }

    /// <summary>
    /// GET /api/admin/monitoring/system-health — Database size, record counts, memory usage.
    /// </summary>
    [HttpGet("system-health")]
    public async Task<IActionResult> GetSystemHealth()
    {
        var dbPath = _db.Database.GetConnectionString()
            ?.Replace("Data Source=", "", StringComparison.OrdinalIgnoreCase)
            .Trim();

        long dbSizeBytes = 0;
        if (!string.IsNullOrEmpty(dbPath) && System.IO.File.Exists(dbPath))
        {
            dbSizeBytes = new FileInfo(dbPath).Length;
        }

        var counts = new Dictionary<string, int>
        {
            ["services"] = await _db.Services.CountAsync(),
            ["blogPosts"] = await _db.BlogPosts.CountAsync(),
            ["blogCategories"] = await _db.BlogCategories.CountAsync(),
            ["testimonials"] = await _db.Testimonials.CountAsync(),
            ["caseStudies"] = await _db.CaseStudies.CountAsync(),
            ["contactMessages"] = await _db.ContactMessages.CountAsync(),
            ["newsletterSubscribers"] = await _db.NewsletterSubscribers.CountAsync(),
            ["chatRequests"] = await _db.ChatRequests.CountAsync(),
            ["teamMembers"] = await _db.TeamMembers.CountAsync(),
            ["videoDemos"] = await _db.VideoDemos.CountAsync(),
            ["industrySolutions"] = await _db.IndustrySolutions.CountAsync(),
            ["auditLogs"] = await _db.AuditLogs.CountAsync(),
            ["apiRequestLogs"] = await _db.ApiRequestLogs.CountAsync()
        };

        var process = System.Diagnostics.Process.GetCurrentProcess();

        return Ok(new
        {
            database = new
            {
                sizeBytes = dbSizeBytes,
                sizeMb = Math.Round(dbSizeBytes / 1024.0 / 1024.0, 2),
                provider = "SQLite"
            },
            recordCounts = counts,
            runtime = new
            {
                workingSetMb = Math.Round(process.WorkingSet64 / 1024.0 / 1024.0, 2),
                uptime = (DateTime.UtcNow - process.StartTime.ToUniversalTime()).ToString(@"d\.hh\:mm\:ss"),
                environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production",
                framework = System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription
            }
        });
    }

    /// <summary>
    /// GET /api/admin/monitoring/logs/recent — Read last N lines from Serilog log file.
    /// </summary>
    [HttpGet("logs/recent")]
    public IActionResult GetRecentLogs([FromQuery] int lines = 100, [FromQuery] string? level = null)
    {
        var logDir = Path.Combine(AppContext.BaseDirectory, "logs");
        if (!Directory.Exists(logDir))
            return Ok(new { entries = Array.Empty<object>(), message = "No log directory found" });

        var logFile = Directory.GetFiles(logDir, "*.log")
            .OrderByDescending(f => new FileInfo(f).LastWriteTimeUtc)
            .FirstOrDefault();

        if (logFile == null)
            return Ok(new { entries = Array.Empty<object>(), message = "No log files found" });

        // Read last N lines safely
        var allLines = System.IO.File.ReadAllLines(logFile);
        var recentLines = allLines.TakeLast(lines * 2).ToList(); // Take extra, then filter

        if (!string.IsNullOrWhiteSpace(level))
        {
            recentLines = recentLines
                .Where(l => l.Contains($"[{level.ToUpper()}]", StringComparison.OrdinalIgnoreCase) ||
                            l.Contains($"\"{level}\"", StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        var entries = recentLines.TakeLast(lines).Select((line, idx) => new
        {
            lineNumber = idx + 1,
            content = line,
            level = ExtractLogLevel(line)
        });

        return Ok(new
        {
            entries,
            file = Path.GetFileName(logFile),
            totalLines = allLines.Length
        });
    }

    private static string ExtractLogLevel(string line)
    {
        if (line.Contains("[ERR]") || line.Contains("[Error]") || line.Contains("\"Error\""))
            return "Error";
        if (line.Contains("[WRN]") || line.Contains("[Warning]") || line.Contains("\"Warning\""))
            return "Warning";
        if (line.Contains("[INF]") || line.Contains("[Information]") || line.Contains("\"Information\""))
            return "Information";
        if (line.Contains("[DBG]") || line.Contains("[Debug]") || line.Contains("\"Debug\""))
            return "Debug";
        return "Information";
    }
}
