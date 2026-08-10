using Microsoft.AspNetCore.SignalR;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Hubs;

/// <summary>
/// SignalR hub for real-time live chat between website visitors and admin.
///
/// Connection flows:
///   Customer connects → JoinSession(sessionId, name, email) → joined to group "session-{sessionId}"
///   Admin connects   → JoinAdminRoom()                      → joined to group "admins"
///
/// Messaging:
///   Customer sends  → SendMessage(sessionId, content) → saved to DB, relayed to "admins"
///   Admin replies   → AdminReply(sessionId, content)  → saved to DB, relayed to "session-{sessionId}"
/// </summary>
public class ChatHub : Hub
{
    private readonly IUnitOfWork _uow;
    private readonly ILogger<ChatHub> _logger;

    public ChatHub(IUnitOfWork uow, ILogger<ChatHub> logger)
    {
        _uow = uow;
        _logger = logger;
    }

    // ── Customer: join their session group ────────────────────────────────────
    public async Task JoinSession(string sessionId, string name, string email)
    {
        if (string.IsNullOrWhiteSpace(sessionId) || sessionId.Length > 100)
            throw new HubException("Invalid session ID.");
        if (string.IsNullOrWhiteSpace(name) || name.Length > 200)
            throw new HubException("Invalid name.");

        await Groups.AddToGroupAsync(Context.ConnectionId, $"session-{sessionId}");

        _logger.LogInformation("Customer {Name} joined session {SessionId}", name, sessionId);

        // Notify admins a new customer connected
        await Clients.Group("admins").SendAsync("CustomerConnected", new
        {
            sessionId,
            name,
            email,
            connectedAt = DateTime.UtcNow
        });
    }

    // ── Admin: join the admins group ──────────────────────────────────────────
    public async Task JoinAdminRoom()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "admins");
        _logger.LogInformation("Admin joined live chat room. ConnectionId={Id}", Context.ConnectionId);
    }

    // ── Customer sends a message ──────────────────────────────────────────────
    public async Task SendMessage(string sessionId, string name, string email, string content, string? customerId = null)
    {
        if (string.IsNullOrWhiteSpace(sessionId) || sessionId.Length > 100)
            throw new HubException("Invalid session ID.");
        if (string.IsNullOrWhiteSpace(content))
            throw new HubException("Message content is required.");
        if (content.Length > 5000)
            throw new HubException("Message too long. Maximum 5000 characters.");

        var msg = new ChatMessage
        {
            SessionId = sessionId,
            SenderName = name,
            SenderEmail = email,
            Content = content,
            IsFromAdmin = false,
            IsRead = false,
            CustomerId = customerId
        };

        await _uow.ChatMessages.AddAsync(msg);
        await _uow.SaveChangesAsync();

        var payload = new
        {
            id = msg.Id,
            sessionId,
            senderName = name,
            senderEmail = email,
            content,
            isFromAdmin = false,
            createdAt = msg.CreatedAt
        };

        // Relay to admins
        await Clients.Group("admins").SendAsync("ReceiveMessage", payload);

        // Echo back to the customer's own session group (for multi-tab support)
        await Clients.Group($"session-{sessionId}").SendAsync("ReceiveMessage", payload);
    }

    // ── Admin replies to a specific session ───────────────────────────────────
    public async Task AdminReply(string sessionId, string adminName, string content)
    {
        if (string.IsNullOrWhiteSpace(sessionId) || sessionId.Length > 100)
            throw new HubException("Invalid session ID.");
        if (string.IsNullOrWhiteSpace(content))
            throw new HubException("Message content is required.");
        if (content.Length > 5000)
            throw new HubException("Message too long. Maximum 5000 characters.");

        var msg = new ChatMessage
        {
            SessionId = sessionId,
            SenderName = adminName,
            Content = content,
            IsFromAdmin = true,
            IsRead = true
        };

        await _uow.ChatMessages.AddAsync(msg);
        await _uow.SaveChangesAsync();

        var payload = new
        {
            id = msg.Id,
            sessionId,
            senderName = adminName,
            content,
            isFromAdmin = true,
            createdAt = msg.CreatedAt
        };

        // Send to the customer's session group
        await Clients.Group($"session-{sessionId}").SendAsync("ReceiveMessage", payload);

        // Echo back to all admins so they see the reply
        await Clients.Group("admins").SendAsync("ReceiveMessage", payload);
    }

    // ── Admin: mark session messages as read ──────────────────────────────────
    public async Task MarkRead(string sessionId)
    {
        await _uow.ChatMessages.MarkSessionReadAsync(sessionId);
        await _uow.SaveChangesAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _logger.LogDebug("Client disconnected: {ConnectionId}", Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
