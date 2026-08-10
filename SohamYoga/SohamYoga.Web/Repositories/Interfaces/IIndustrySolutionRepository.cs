using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Repositories.Interfaces;

public interface IIndustrySolutionRepository : IRepository<IndustrySolution>
{
    Task<IndustrySolution?> GetBySlugAsync(string slug);
    Task<IEnumerable<IndustrySolution>> GetActiveOrderedAsync();
}
