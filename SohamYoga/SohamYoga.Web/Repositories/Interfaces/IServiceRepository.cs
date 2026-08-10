using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Repositories.Interfaces;

public interface IServiceRepository : IRepository<Service>
{
    Task<Service?> GetBySlugAsync(string slug);
    Task<IEnumerable<Service>> GetFeaturedAsync();
    Task<IEnumerable<Service>> GetByCategoryAsync(string category);
    Task<IEnumerable<Service>> GetActiveOrderedAsync();
}
