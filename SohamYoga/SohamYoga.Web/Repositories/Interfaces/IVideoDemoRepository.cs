using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Repositories.Interfaces;

public interface IVideoDemoRepository : IRepository<VideoDemo>
{
    Task<IEnumerable<VideoDemo>> GetActiveOrderedAsync();
    Task<IEnumerable<VideoDemo>> GetByCategoryAsync(string category);
}
