using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Services.Interfaces;

public interface IContactService
{
    Task<ContactMessage> SubmitMessageAsync(ContactMessage message);
    Task<IEnumerable<ContactMessage>> GetAllMessagesAsync();
    Task<ContactMessage?> GetMessageByIdAsync(int id);
    Task MarkAsReadAsync(int id);
    Task ArchiveMessageAsync(int id);
    Task<int> GetUnreadCountAsync();
}
