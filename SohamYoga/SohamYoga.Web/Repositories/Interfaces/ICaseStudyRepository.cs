using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Repositories.Interfaces;

public interface ICaseStudyRepository : IRepository<CaseStudy>
{
    Task<CaseStudy?> GetBySlugAsync(string slug);
    Task<IEnumerable<CaseStudy>> GetActiveOrderedAsync();
}
