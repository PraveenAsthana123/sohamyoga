using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Data;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Repositories.Implementations;

public class TeamMemberRepository : Repository<TeamMember>, ITeamMemberRepository
{
    public TeamMemberRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<TeamMember>> GetActiveOrderedAsync()
    {
        return await _dbSet
            .Where(tm => tm.IsActive)
            .OrderBy(tm => tm.SortOrder)
            .ToListAsync();
    }
}
