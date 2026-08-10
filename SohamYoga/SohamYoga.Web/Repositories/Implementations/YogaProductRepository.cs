using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Data;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Repositories.Implementations;

public class YogaProductRepository : Repository<YogaProduct>, IYogaProductRepository
{
    public YogaProductRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<YogaProduct?> GetBySlugAsync(string slug)
    {
        return await _dbSet.FirstOrDefaultAsync(p => p.Slug == slug);
    }

    public async Task<IEnumerable<YogaProduct>> GetFeaturedAsync()
    {
        return await _dbSet
            .Where(p => p.IsActive && p.IsFeatured)
            .OrderBy(p => p.SortOrder)
            .ToListAsync();
    }

    public async Task<IEnumerable<YogaProduct>> GetByCategoryAsync(string category)
    {
        return await _dbSet
            .Where(p => p.IsActive && p.Category == category)
            .OrderBy(p => p.SortOrder)
            .ToListAsync();
    }

    public async Task<IEnumerable<YogaProduct>> GetActiveOrderedAsync()
    {
        return await _dbSet
            .Where(p => p.IsActive)
            .OrderBy(p => p.SortOrder)
            .ToListAsync();
    }
}
