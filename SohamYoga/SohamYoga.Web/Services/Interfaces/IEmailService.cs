using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Services.Interfaces;

public interface IEmailService
{
    Task SendContactNotificationAsync(ContactMessage message);
    Task SendContactAutoReplyAsync(ContactMessage message);
    Task SendNewsletterConfirmationAsync(string email, string token);
}
