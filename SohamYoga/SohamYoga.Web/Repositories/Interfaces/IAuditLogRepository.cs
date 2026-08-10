using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Repositories.Interfaces;

public interface IAuditLogRepository : IRepository<AuditLog>
{
    Task<List<AuditLog>> GetRecentAsync(int count);
    Task<(List<AuditLog> Items, int Total)> GetPaginatedAsync(
        int page, int pageSize,
        string? action = null, string? entityType = null, string? userId = null);
    Task<int> DeleteOlderThanAsync(DateTime cutoff);
}
