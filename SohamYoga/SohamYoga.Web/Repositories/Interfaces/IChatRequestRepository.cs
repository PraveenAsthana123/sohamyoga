using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Repositories.Interfaces;

public interface IChatRequestRepository : IRepository<ChatRequest>
{
    Task<IEnumerable<ChatRequest>> GetUnresolvedAsync();
    Task<int> GetUnresolvedCountAsync();
    Task<IEnumerable<ChatRequest>> GetByAssigneeAsync(string assignedTo);
}
