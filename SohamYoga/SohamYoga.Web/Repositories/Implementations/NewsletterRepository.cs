using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Data;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Repositories.Implementations;

public class NewsletterRepository : Repository<NewsletterSubscriber>, INewsletterRepository
{
    public NewsletterRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<NewsletterSubscriber?> GetByEmailAsync(string email)
    {
        return await _dbSet.FirstOrDefaultAsync(ns =>
            ns.Email.ToLower() == email.ToLower());
    }

    public async Task<NewsletterSubscriber?> GetByTokenAsync(string token)
    {
        return await _dbSet.FirstOrDefaultAsync(ns => ns.Token == token);
    }

    public async Task<IEnumerable<NewsletterSubscriber>> GetActiveSubscribersAsync()
    {
        return await _dbSet
            .Where(ns => ns.IsActive)
            .OrderByDescending(ns => ns.SubscribedAt)
            .ToListAsync();
    }
}
