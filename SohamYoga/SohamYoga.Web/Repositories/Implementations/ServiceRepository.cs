using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Data;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Repositories.Implementations;

public class ServiceRepository : Repository<Service>, IServiceRepository
{
    public ServiceRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<Service?> GetBySlugAsync(string slug)
    {
        return await _dbSet.FirstOrDefaultAsync(s => s.Slug == slug);
    }

    public async Task<IEnumerable<Service>> GetFeaturedAsync()
    {
        return await _dbSet
            .Where(s => s.IsActive && s.IsFeatured)
            .OrderBy(s => s.SortOrder)
            .ToListAsync();
    }

    public async Task<IEnumerable<Service>> GetByCategoryAsync(string category)
    {
        return await _dbSet
            .Where(s => s.IsActive && s.Category == category)
            .OrderBy(s => s.SortOrder)
            .ToListAsync();
    }

    public async Task<IEnumerable<Service>> GetActiveOrderedAsync()
    {
        return await _dbSet
            .Where(s => s.IsActive)
            .OrderBy(s => s.SortOrder)
            .ToListAsync();
    }
}
