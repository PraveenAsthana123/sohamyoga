using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Data;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Repositories.Implementations;

public class IndustrySolutionRepository : Repository<IndustrySolution>, IIndustrySolutionRepository
{
    public IndustrySolutionRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<IndustrySolution?> GetBySlugAsync(string slug)
    {
        return await _dbSet.FirstOrDefaultAsync(i => i.Slug == slug);
    }

    public async Task<IEnumerable<IndustrySolution>> GetActiveOrderedAsync()
    {
        return await _dbSet
            .Where(i => i.IsActive)
            .OrderBy(i => i.SortOrder)
            .ToListAsync();
    }
}
