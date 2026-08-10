using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SohamYoga.Web.Services.Interfaces;

namespace SohamYoga.Web.Controllers.Api;

/// <summary>
/// Request model for newsletter subscription.
/// </summary>
public record SubscribeRequest
{
    public string Email { get; init; } = string.Empty;
    public string? Name { get; init; }
}

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class NewsletterController : ControllerBase
{
    private readonly INewsletterService _newsletterService;
    private readonly ILogger<NewsletterController> _logger;

    public NewsletterController(INewsletterService newsletterService, ILogger<NewsletterController> logger)
    {
        _newsletterService = newsletterService;
        _logger = logger;
    }

    /// <summary>
    /// Subscribes an email to the newsletter. Public endpoint.
    /// </summary>
    [HttpPost("subscribe")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Subscribe([FromBody] SubscribeRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(new { detail = "Email is required.", error_code = "VALIDATION_ERROR" });
            }

            var (success, message) = await _newsletterService.SubscribeAsync(request.Email, request.Name);
            if (!success)
            {
                return BadRequest(new { detail = message, error_code = "DUPLICATE_SUBSCRIPTION" });
            }

            return Ok(new { detail = message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error subscribing email to newsletter");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while processing the subscription.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Unsubscribes from the newsletter using a token. Public endpoint.
    /// </summary>
    [HttpGet("unsubscribe/{token}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Unsubscribe(string token)
    {
        try
        {
            var result = await _newsletterService.UnsubscribeAsync(token);
            if (!result)
            {
                return NotFound(new { detail = "Invalid or expired unsubscribe token.", error_code = "NOT_FOUND" });
            }

            return Ok(new { detail = "Successfully unsubscribed from the newsletter." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unsubscribing from newsletter with token {Token}", token);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while processing the unsubscription.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Confirms a newsletter subscription using a token. Public endpoint.
    /// </summary>
    [HttpGet("confirm/{token}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Confirm(string token)
    {
        try
        {
            var result = await _newsletterService.ConfirmSubscriptionAsync(token);
            if (!result)
            {
                return NotFound(new { detail = "Invalid or expired confirmation token.", error_code = "NOT_FOUND" });
            }

            return Ok(new { detail = "Email subscription confirmed successfully." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error confirming newsletter subscription with token {Token}", token);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while confirming the subscription.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets all newsletter subscribers. Requires Admin or Sales role.
    /// </summary>
    [HttpGet("subscribers")]
    [Authorize(Roles = "Admin,Sales")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetSubscribers()
    {
        try
        {
            var subscribers = await _newsletterService.GetActiveSubscribersAsync();
            return Ok(subscribers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving newsletter subscribers");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving subscribers.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets the total subscriber count. Requires Admin or Sales role.
    /// </summary>
    [HttpGet("count")]
    [Authorize(Roles = "Admin,Sales")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetCount()
    {
        try
        {
            var count = await _newsletterService.GetSubscriberCountAsync();
            return Ok(new { count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving subscriber count");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving the subscriber count.", error_code = "INTERNAL_ERROR" });
        }
    }
}
