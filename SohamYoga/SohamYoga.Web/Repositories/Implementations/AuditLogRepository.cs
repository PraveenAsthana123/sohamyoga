using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Data;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Repositories.Implementations;

public class AuditLogRepository : Repository<AuditLog>, IAuditLogRepository
{
    public AuditLogRepository(ApplicationDbContext context) : base(context) { }

    public async Task<List<AuditLog>> GetRecentAsync(int count)
    {
        return await _dbSet
            .OrderByDescending(a => a.CreatedAt)
            .Take(count)
            .ToListAsync();
    }

    public async Task<(List<AuditLog> Items, int Total)> GetPaginatedAsync(
        int page, int pageSize,
        string? action = null, string? entityType = null, string? userId = null)
    {
        var query = _dbSet.AsQueryable();

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

        return (items, total);
    }

    public async Task<int> DeleteOlderThanAsync(DateTime cutoff)
    {
        return await _dbSet.Where(a => a.CreatedAt < cutoff).ExecuteDeleteAsync();
    }
}
