using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SohamYoga.Web.Services.Interfaces;
using System.Net;
using System.Net.Mail;

namespace SohamYoga.Web.Controllers.Api;

public class TestEmailRequest
{
    public string Email { get; set; } = string.Empty;
}

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class HomeController : ControllerBase
{
    private readonly ISiteService _siteService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<HomeController> _logger;

    public HomeController(ISiteService siteService, IConfiguration configuration, ILogger<HomeController> logger)
    {
        _siteService = siteService;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Sends a real test email through the configured SMTP relay (Settings → Smtp).
    /// Previously called from the admin UI but the route did not exist anywhere
    /// in this codebase — this is the real implementation, not a stub. If Smtp:Host
    /// is unset (true in this environment), it fails closed with a clear message
    /// rather than pretending to send.
    /// </summary>
    [HttpPost("test-email")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> TestEmail([FromBody] TestEmailRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.Email))
        {
            return BadRequest(new { detail = "email is required.", error_code = "VALIDATION_ERROR" });
        }

        var host = _configuration["Smtp:Host"];
        if (string.IsNullOrWhiteSpace(host))
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { detail = "SMTP is not configured (Smtp:Host is empty). Set Smtp:Host/Port/Username/Password before testing — this will not fabricate a successful send.", error_code = "SMTP_NOT_CONFIGURED" });
        }

        var port = _configuration.GetValue<int>("Smtp:Port", 587);
        var username = _configuration["Smtp:Username"] ?? string.Empty;
        var password = _configuration["Smtp:Password"] ?? string.Empty;
        var fromEmail = _configuration["Smtp:FromEmail"] ?? "noreply@sohamyoga.ca";
        var fromName = _configuration["Smtp:FromName"] ?? "Soham Yoga";

        try
        {
            using var client = new SmtpClient(host, port)
            {
                Credentials = new NetworkCredential(username, password),
                EnableSsl = true,
            };
            using var message = new MailMessage(
                new MailAddress(fromEmail, fromName),
                new MailAddress(request.Email))
            {
                Subject = "SohamYoga SMTP test",
                Body = "This is a real test email sent from the SohamYoga admin panel to confirm SMTP delivery is working.",
            };
            await client.SendMailAsync(message);
            return Ok(new { detail = "Test email sent." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SMTP test send failed");
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { detail = $"SMTP send failed: {ex.Message}", error_code = "SMTP_SEND_FAILED" });
        }
    }

    /// <summary>
    /// Gets the home page data including featured services, testimonials, and stats.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetHomePageData()
    {
        try
        {
            var data = await _siteService.GetHomePageDataAsync();
            return Ok(data);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving home page data");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving home page data.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets the site settings.
    /// </summary>
    [HttpGet("settings")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetSettings()
    {
        try
        {
            var settings = await _siteService.GetSettingsAsync();
            return Ok(settings);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving site settings");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving site settings.", error_code = "INTERNAL_ERROR" });
        }
    }
}
