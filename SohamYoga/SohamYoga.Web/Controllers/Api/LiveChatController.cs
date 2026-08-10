using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Controllers.Api;

[ApiController]
[Route("api/live-chat")]
[Produces("application/json")]
public class LiveChatController : ControllerBase
{
    private readonly IUnitOfWork _uow;
    private readonly ILogger<LiveChatController> _logger;

    public LiveChatController(IUnitOfWork uow, ILogger<LiveChatController> logger)
    {
        _uow = uow;
        _logger = logger;
    }

    /// <summary>GET /api/live-chat/history/{sessionId} — fetch message history for a session</summary>
    /// <remarks>Requires valid GUID session ID to prevent enumeration attacks</remarks>
    [HttpGet("history/{sessionId}")]
    public async Task<IActionResult> GetHistory(string sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
            return BadRequest(new { detail = "sessionId is required.", error_code = "VALIDATION_ERROR" });

        // Validate session ID format (must be UUID to prevent enumeration)
        if (!Guid.TryParse(sessionId, out _) && sessionId.Length > 100)
            return BadRequest(new { detail = "Invalid session ID format.", error_code = "VALIDATION_ERROR" });

        var messages = await _uow.ChatMessages.GetBySessionIdAsync(sessionId);
        // Don't expose email in public endpoint — only admins see emails
        return Ok(messages.Select(m => new
        {
            m.Id,
            m.SessionId,
            m.SenderName,
            m.Content,
            m.IsFromAdmin,
            m.IsRead,
            m.CreatedAt
        }));
    }

    /// <summary>GET /api/live-chat/sessions — list all active sessions in the last 24h (admin only)</summary>
    [HttpGet("sessions")]
    [Authorize(Roles = "Admin,Sales")]
    public async Task<IActionResult> GetActiveSessions([FromQuery] int hours = 24)
    {
        var sessionIds = await _uow.ChatMessages.GetActiveSessionIdsAsync(hours);

        // For each session, get the last message and unread count
        var sessions = new List<object>();
        foreach (var sid in sessionIds)
        {
            var msgs = (await _uow.ChatMessages.GetBySessionIdAsync(sid)).ToList();
            var last = msgs.LastOrDefault();
            var unread = msgs.Count(m => !m.IsRead && !m.IsFromAdmin);
            sessions.Add(new
            {
                sessionId = sid,
                customerName = msgs.FirstOrDefault(m => !m.IsFromAdmin)?.SenderName ?? "Unknown",
                customerEmail = msgs.FirstOrDefault(m => !m.IsFromAdmin)?.SenderEmail,
                messageCount = msgs.Count,
                unreadCount = unread,
                lastMessage = last?.Content,
                lastMessageAt = last?.CreatedAt,
                lastIsFromAdmin = last?.IsFromAdmin
            });
        }

        return Ok(sessions.OrderByDescending(s => ((dynamic)s).lastMessageAt));
    }

    /// <summary>GET /api/live-chat/unread-count — unread message count for badge (admin only)</summary>
    [HttpGet("unread-count")]
    [Authorize(Roles = "Admin,Sales")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var count = await _uow.ChatMessages.GetUnreadCountAsync();
        return Ok(new { count });
    }

    /// <summary>GET /api/live-chat/customer-sessions — sessions for logged-in customer</summary>
    [HttpGet("customer-sessions")]
    [Authorize(Roles = "Customer")]
    public async Task<IActionResult> GetCustomerSessions()
    {
        var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId))
            return Unauthorized();

        var all = await _uow.ChatMessages.GetAllAsync();
        var customerMsgs = all.Where(m => m.CustomerId == userId).ToList();
        var sessionIds = customerMsgs.Select(m => m.SessionId).Distinct();

        var sessions = new List<object>();
        foreach (var sid in sessionIds)
        {
            var msgs = customerMsgs.Where(m => m.SessionId == sid).OrderBy(m => m.CreatedAt).ToList();
            var last = msgs.LastOrDefault();
            sessions.Add(new
            {
                sessionId = sid,
                messageCount = msgs.Count,
                lastMessage = last?.Content,
                lastMessageAt = last?.CreatedAt
            });
        }

        return Ok(sessions.OrderByDescending(s => ((dynamic)s).lastMessageAt));
    }
}
