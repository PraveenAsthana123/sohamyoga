using System.Diagnostics;
using System.Security.Claims;
using SohamYoga.Web.Data;
using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Middleware;

/// <summary>
/// Tracks API request metrics (method, path, status, duration) for monitoring.
/// Writes asynchronously to avoid impacting request latency.
/// Skips static files, health checks, and Swagger endpoints.
/// </summary>
public class ApiRequestTrackingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ApiRequestTrackingMiddleware> _logger;

    private static readonly HashSet<string> SkipPrefixes = new(StringComparer.OrdinalIgnoreCase)
    {
        "/swagger",
        "/api/health",
        "/_next",
        "/favicon.ico"
    };

    public ApiRequestTrackingMiddleware(RequestDelegate next, ILogger<ApiRequestTrackingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? "/";

        // Skip non-API and utility endpoints
        if (ShouldSkip(path))
        {
            await _next(context);
            return;
        }

        var stopwatch = Stopwatch.StartNew();

        await _next(context);

        stopwatch.Stop();

        // Fire-and-forget DB write via scoped service
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = context.RequestServices.GetRequiredService<IServiceScopeFactory>().CreateScope();
                var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                var log = new ApiRequestLog
                {
                    Method = context.Request.Method,
                    Path = path,
                    StatusCode = context.Response.StatusCode,
                    DurationMs = stopwatch.ElapsedMilliseconds,
                    ClientIp = context.Connection.RemoteIpAddress?.ToString(),
                    UserAgent = context.Request.Headers.UserAgent.ToString(),
                    UserId = context.User?.FindFirstValue(ClaimTypes.NameIdentifier),
                    CorrelationId = context.Items["CorrelationId"]?.ToString(),
                    QueryString = context.Request.QueryString.HasValue
                        ? context.Request.QueryString.Value
                        : null,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                dbContext.Set<ApiRequestLog>().Add(log);
                await dbContext.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to log API request for {Path}", path);
            }
        });
    }

    private static bool ShouldSkip(string path)
    {
        foreach (var prefix in SkipPrefixes)
        {
            if (path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }
}
