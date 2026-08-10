using Microsoft.Extensions.Logging;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;
using SohamYoga.Web.Services.Interfaces;

namespace SohamYoga.Web.Services.Implementations;

public class ContactService : IContactService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IEmailService _emailService;
    private readonly ILogger<ContactService> _logger;

    public ContactService(
        IUnitOfWork unitOfWork,
        IEmailService emailService,
        ILogger<ContactService> logger)
    {
        _unitOfWork = unitOfWork;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<ContactMessage> SubmitMessageAsync(ContactMessage message)
    {
        message.CreatedAt = DateTime.UtcNow;
        message.UpdatedAt = DateTime.UtcNow;
        message.IsRead = false;
        message.IsArchived = false;

        await _unitOfWork.Contacts.AddAsync(message);
        await _unitOfWork.SaveChangesAsync();

        // Fire-and-forget email notifications -- do not fail the submission if email fails
        _ = Task.Run(async () =>
        {
            try
            {
                await _emailService.SendContactNotificationAsync(message);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "Failed to send contact notification email for message ID {MessageId}",
                    message.Id);
            }

            try
            {
                await _emailService.SendContactAutoReplyAsync(message);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex,
                    "Failed to send auto-reply email for message ID {MessageId} to {Email}",
                    message.Id, message.Email);
            }
        });

        return message;
    }

    public async Task<IEnumerable<ContactMessage>> GetAllMessagesAsync()
    {
        return await _unitOfWork.Contacts.GetAllAsync();
    }

    public async Task<ContactMessage?> GetMessageByIdAsync(int id)
    {
        return await _unitOfWork.Contacts.GetByIdAsync(id);
    }

    public async Task MarkAsReadAsync(int id)
    {
        var message = await _unitOfWork.Contacts.GetByIdAsync(id);
        if (message == null)
        {
            throw new KeyNotFoundException($"Contact message with ID {id} was not found.");
        }

        message.IsRead = true;
        message.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Contacts.Update(message);
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task ArchiveMessageAsync(int id)
    {
        var message = await _unitOfWork.Contacts.GetByIdAsync(id);
        if (message == null)
        {
            throw new KeyNotFoundException($"Contact message with ID {id} was not found.");
        }

        message.IsArchived = true;
        message.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Contacts.Update(message);
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task<int> GetUnreadCountAsync()
    {
        return await _unitOfWork.Contacts.GetUnreadCountAsync();
    }
}
