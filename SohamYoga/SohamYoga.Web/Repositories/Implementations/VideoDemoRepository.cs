using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Data;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Repositories.Implementations;

public class VideoDemoRepository : Repository<VideoDemo>, IVideoDemoRepository
{
    public VideoDemoRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<VideoDemo>> GetActiveOrderedAsync()
    {
        return await _dbSet
            .Where(v => v.IsActive)
            .OrderBy(v => v.SortOrder)
            .ToListAsync();
    }

    public async Task<IEnumerable<VideoDemo>> GetByCategoryAsync(string category)
    {
        return await _dbSet
            .Where(v => v.IsActive && v.Category == category)
            .OrderBy(v => v.SortOrder)
            .ToListAsync();
    }
}
