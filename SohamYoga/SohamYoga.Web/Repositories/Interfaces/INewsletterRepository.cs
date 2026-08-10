using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Repositories.Interfaces;

public interface INewsletterRepository : IRepository<NewsletterSubscriber>
{
    Task<NewsletterSubscriber?> GetByEmailAsync(string email);
    Task<NewsletterSubscriber?> GetByTokenAsync(string token);
    Task<IEnumerable<NewsletterSubscriber>> GetActiveSubscribersAsync();
}
