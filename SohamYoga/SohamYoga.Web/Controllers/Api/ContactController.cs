using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Services.Interfaces;

namespace SohamYoga.Web.Controllers.Api;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ContactController : ControllerBase
{
    private readonly IContactService _contactService;
    private readonly ILogger<ContactController> _logger;

    public ContactController(IContactService contactService, ILogger<ContactController> logger)
    {
        _contactService = contactService;
        _logger = logger;
    }

    /// <summary>
    /// Submits a contact message. Public endpoint.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Submit([FromBody] ContactMessage message)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid contact message data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            if (string.IsNullOrWhiteSpace(message.Name))
            {
                return BadRequest(new { detail = "Name is required.", error_code = "VALIDATION_ERROR" });
            }

            if (string.IsNullOrWhiteSpace(message.Email))
            {
                return BadRequest(new { detail = "Email is required.", error_code = "VALIDATION_ERROR" });
            }

            if (string.IsNullOrWhiteSpace(message.Subject))
            {
                return BadRequest(new { detail = "Subject is required.", error_code = "VALIDATION_ERROR" });
            }

            if (string.IsNullOrWhiteSpace(message.Message))
            {
                return BadRequest(new { detail = "Message is required.", error_code = "VALIDATION_ERROR" });
            }

            var created = await _contactService.SubmitMessageAsync(message);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting contact message");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while submitting the contact message.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets all contact messages. Requires Admin or Sales role.
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "Admin,Sales")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var messages = await _contactService.GetAllMessagesAsync();
            return Ok(messages);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving contact messages");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving contact messages.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets a contact message by ID. Requires Admin or Sales role.
    /// </summary>
    [HttpGet("{id}")]
    [Authorize(Roles = "Admin,Sales")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetById(int id)
    {
        try
        {
            var message = await _contactService.GetMessageByIdAsync(id);
            if (message == null)
            {
                return NotFound(new { detail = $"Contact message with ID {id} not found.", error_code = "NOT_FOUND" });
            }

            return Ok(message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving contact message with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving the contact message.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Marks a contact message as read. Requires Admin or Sales role.
    /// </summary>
    [HttpPut("{id}/read")]
    [Authorize(Roles = "Admin,Sales")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> MarkAsRead(int id)
    {
        try
        {
            await _contactService.MarkAsReadAsync(id);
            return Ok(new { detail = "Message marked as read." });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { detail = $"Contact message with ID {id} not found.", error_code = "NOT_FOUND" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error marking contact message {Id} as read", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while marking the message as read.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Archives a contact message. Requires Admin or Sales role.
    /// </summary>
    [HttpPut("{id}/archive")]
    [Authorize(Roles = "Admin,Sales")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Archive(int id)
    {
        try
        {
            await _contactService.ArchiveMessageAsync(id);
            return Ok(new { detail = "Message archived." });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { detail = $"Contact message with ID {id} not found.", error_code = "NOT_FOUND" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error archiving contact message {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while archiving the message.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets the count of unread contact messages. Requires Admin or Sales role.
    /// </summary>
    [HttpGet("unread-count")]
    [Authorize(Roles = "Admin,Sales")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetUnreadCount()
    {
        try
        {
            var count = await _contactService.GetUnreadCountAsync();
            return Ok(new { count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving unread message count");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving the unread message count.", error_code = "INTERNAL_ERROR" });
        }
    }
}
