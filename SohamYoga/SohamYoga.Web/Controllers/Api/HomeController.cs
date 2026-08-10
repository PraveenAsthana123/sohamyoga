using Microsoft.AspNetCore.Mvc;
using SohamYoga.Web.Services.Interfaces;

namespace SohamYoga.Web.Controllers.Api;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class HomeController : ControllerBase
{
    private readonly ISiteService _siteService;
    private readonly ILogger<HomeController> _logger;

    public HomeController(ISiteService siteService, ILogger<HomeController> logger)
    {
        _siteService = siteService;
        _logger = logger;
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
