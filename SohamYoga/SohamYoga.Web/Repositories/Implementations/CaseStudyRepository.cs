using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Data;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Repositories.Implementations;

public class CaseStudyRepository : Repository<CaseStudy>, ICaseStudyRepository
{
    public CaseStudyRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<CaseStudy?> GetBySlugAsync(string slug)
    {
        return await _dbSet.FirstOrDefaultAsync(cs => cs.Slug == slug);
    }

    public async Task<IEnumerable<CaseStudy>> GetActiveOrderedAsync()
    {
        return await _dbSet
            .Where(cs => cs.IsActive)
            .OrderBy(cs => cs.SortOrder)
            .ToListAsync();
    }
}
