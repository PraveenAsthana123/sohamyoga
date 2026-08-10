using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Controllers;

[ApiController]
[Route("api/chat-requests")]
public class ChatRequestsController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<ChatRequestsController> _logger;

    public ChatRequestsController(IUnitOfWork unitOfWork, ILogger<ChatRequestsController> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    // POST: api/chat-requests (Public)
    [HttpPost]
    public async Task<ActionResult<ChatRequest>> Submit([FromBody] ChatRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        request.IsResolved = false;
        request.Priority ??= "Normal";

        await _unitOfWork.ChatRequests.AddAsync(request);
        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("New chat request from {Email}, Type: {RequestType}", request.Email, request.RequestType);

        return CreatedAtAction(nameof(GetById), new { id = request.Id }, request);
    }

    // GET: api/chat-requests (Admin only)
    [HttpGet]
    [Authorize(Roles = "Admin,Sales")]
    public async Task<ActionResult<IEnumerable<ChatRequest>>> GetAll()
    {
        var requests = await _unitOfWork.ChatRequests.GetAllAsync();
        return Ok(requests.OrderByDescending(r => r.CreatedAt));
    }

    // GET: api/chat-requests/unresolved (Admin only)
    [HttpGet("unresolved")]
    [Authorize(Roles = "Admin,Sales")]
    public async Task<ActionResult<IEnumerable<ChatRequest>>> GetUnresolved()
    {
        var requests = await _unitOfWork.ChatRequests.GetUnresolvedAsync();
        return Ok(requests);
    }

    // GET: api/chat-requests/unresolved-count (Admin only)
    [HttpGet("unresolved-count")]
    [Authorize(Roles = "Admin,Sales")]
    public async Task<ActionResult> GetUnresolvedCount()
    {
        var count = await _unitOfWork.ChatRequests.GetUnresolvedCountAsync();
        return Ok(new { count });
    }

    // GET: api/chat-requests/{id} (Admin only)
    [HttpGet("{id}")]
    [Authorize(Roles = "Admin,Sales")]
    public async Task<ActionResult<ChatRequest>> GetById(int id)
    {
        var request = await _unitOfWork.ChatRequests.GetByIdAsync(id);
        if (request == null)
            return NotFound(new { detail = "Chat request not found", error_code = "NOT_FOUND" });

        return Ok(request);
    }

    // PUT: api/chat-requests/{id}/resolve (Admin only)
    [HttpPut("{id}/resolve")]
    [Authorize(Roles = "Admin,Sales")]
    public async Task<IActionResult> Resolve(int id, [FromBody] ResolveRequest body)
    {
        var request = await _unitOfWork.ChatRequests.GetByIdAsync(id);
        if (request == null)
            return NotFound(new { detail = "Chat request not found", error_code = "NOT_FOUND" });

        request.IsResolved = true;
        request.ResolvedAt = DateTime.UtcNow;
        request.AdminNotes = body.AdminNotes;

        _unitOfWork.ChatRequests.Update(request);
        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Chat request {Id} resolved", id);
        return NoContent();
    }

    // PUT: api/chat-requests/{id}/assign (Admin only)
    [HttpPut("{id}/assign")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Assign(int id, [FromBody] AssignRequest body)
    {
        var request = await _unitOfWork.ChatRequests.GetByIdAsync(id);
        if (request == null)
            return NotFound(new { detail = "Chat request not found", error_code = "NOT_FOUND" });

        request.AssignedTo = body.AssignedTo;

        _unitOfWork.ChatRequests.Update(request);
        await _unitOfWork.SaveChangesAsync();

        _logger.LogInformation("Chat request {Id} assigned to {Assignee}", id, body.AssignedTo);
        return NoContent();
    }

    // DELETE: api/chat-requests/{id} (Admin only)
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var request = await _unitOfWork.ChatRequests.GetByIdAsync(id);
        if (request == null)
            return NotFound(new { detail = "Chat request not found", error_code = "NOT_FOUND" });

        _unitOfWork.ChatRequests.Remove(request);
        await _unitOfWork.SaveChangesAsync();

        return NoContent();
    }
}

public class ResolveRequest
{
    public string? AdminNotes { get; set; }
}

public class AssignRequest
{
    public string AssignedTo { get; set; } = string.Empty;
}
