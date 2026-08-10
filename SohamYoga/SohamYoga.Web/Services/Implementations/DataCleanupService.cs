using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Data;

namespace SohamYoga.Web.Services.Implementations;

/// <summary>
/// Background service that runs every 24 hours to purge old records:
/// - ApiRequestLogs older than 30 days
/// - AuditLogs older than 90 days
/// </summary>
public class DataCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DataCleanupService> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromHours(24);

    public DataCleanupService(IServiceScopeFactory scopeFactory, ILogger<DataCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("DataCleanupService started. Will run every {Hours}h", _interval.TotalHours);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunCleanupAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during data cleanup");
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }

    private async Task RunCleanupAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var apiCutoff = DateTime.UtcNow.AddDays(-30);
        var apiDeleted = await db.ApiRequestLogs
            .Where(l => l.CreatedAt < apiCutoff)
            .ExecuteDeleteAsync(ct);

        var auditCutoff = DateTime.UtcNow.AddDays(-90);
        var auditDeleted = await db.AuditLogs
            .Where(l => l.CreatedAt < auditCutoff)
            .ExecuteDeleteAsync(ct);

        if (apiDeleted > 0 || auditDeleted > 0)
        {
            _logger.LogInformation(
                "Data cleanup complete: {ApiDeleted} API request logs, {AuditDeleted} audit logs removed",
                apiDeleted, auditDeleted);
        }
    }
}
