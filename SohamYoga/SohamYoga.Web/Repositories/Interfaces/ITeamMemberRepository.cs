using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Repositories.Interfaces;

public interface ITeamMemberRepository : IRepository<TeamMember>
{
    Task<IEnumerable<TeamMember>> GetActiveOrderedAsync();
}
