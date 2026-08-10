using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;
using SohamYoga.Web.Services.Interfaces;

namespace SohamYoga.Web.Services.Implementations;

public class NewsletterService : INewsletterService
{
    private readonly IUnitOfWork _unitOfWork;

    public NewsletterService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<(bool Success, string Message)> SubscribeAsync(string email, string? name = null)
    {
        var existing = await _unitOfWork.Newsletter.GetByEmailAsync(email);

        if (existing != null)
        {
            if (existing.IsActive)
            {
                return (false, "This email address is already subscribed to our newsletter.");
            }

            // Reactivate a previously unsubscribed user
            existing.IsActive = true;
            existing.Name = name ?? existing.Name;
            existing.UnsubscribedAt = null;
            existing.Token = Guid.NewGuid().ToString("N");
            existing.UpdatedAt = DateTime.UtcNow;

            _unitOfWork.Newsletter.Update(existing);
            await _unitOfWork.SaveChangesAsync();

            return (true, "Welcome back! Your subscription has been reactivated.");
        }

        var subscriber = new NewsletterSubscriber
        {
            Email = email,
            Name = name,
            IsActive = false, // Will become active after confirmation
            Token = Guid.NewGuid().ToString("N"),
            SubscribedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.Newsletter.AddAsync(subscriber);
        await _unitOfWork.SaveChangesAsync();

        return (true, "Thank you for subscribing! Please check your email to confirm your subscription.");
    }

    public async Task<bool> UnsubscribeAsync(string token)
    {
        var subscriber = await _unitOfWork.Newsletter.GetByTokenAsync(token);
        if (subscriber == null)
        {
            return false;
        }

        subscriber.IsActive = false;
        subscriber.UnsubscribedAt = DateTime.UtcNow;
        subscriber.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Newsletter.Update(subscriber);
        await _unitOfWork.SaveChangesAsync();

        return true;
    }

    public async Task<bool> ConfirmSubscriptionAsync(string token)
    {
        var subscriber = await _unitOfWork.Newsletter.GetByTokenAsync(token);
        if (subscriber == null)
        {
            return false;
        }

        subscriber.IsActive = true;
        subscriber.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Newsletter.Update(subscriber);
        await _unitOfWork.SaveChangesAsync();

        return true;
    }

    public async Task<IEnumerable<NewsletterSubscriber>> GetActiveSubscribersAsync()
    {
        return await _unitOfWork.Newsletter.GetActiveSubscribersAsync();
    }

    public async Task<int> GetSubscriberCountAsync()
    {
        return await _unitOfWork.Newsletter.CountAsync(ns => ns.IsActive);
    }
}
