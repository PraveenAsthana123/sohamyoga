using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Repositories.Interfaces;

public interface ITestimonialRepository : IRepository<Testimonial>
{
    Task<IEnumerable<Testimonial>> GetActiveOrderedAsync();
}
