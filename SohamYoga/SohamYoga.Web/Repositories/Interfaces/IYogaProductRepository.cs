using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Repositories.Interfaces;

public interface IYogaProductRepository : IRepository<YogaProduct>
{
    Task<YogaProduct?> GetBySlugAsync(string slug);
    Task<IEnumerable<YogaProduct>> GetFeaturedAsync();
    Task<IEnumerable<YogaProduct>> GetByCategoryAsync(string category);
    Task<IEnumerable<YogaProduct>> GetActiveOrderedAsync();
}
