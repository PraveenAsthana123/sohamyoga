using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Data;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Repositories.Implementations;

public class TestimonialRepository : Repository<Testimonial>, ITestimonialRepository
{
    public TestimonialRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<Testimonial>> GetActiveOrderedAsync()
    {
        return await _dbSet
            .Where(t => t.IsActive)
            .OrderBy(t => t.SortOrder)
            .ToListAsync();
    }
}
