using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Controllers.Api;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class IndustriesController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<IndustriesController> _logger;

    public IndustriesController(IUnitOfWork unitOfWork, ILogger<IndustriesController> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    /// <summary>
    /// Gets all active industry solutions ordered by sort order.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var industries = await _unitOfWork.IndustrySolutions.GetAllAsync();
            var activeIndustries = industries
                .Where(i => i.IsActive)
                .OrderBy(i => i.SortOrder)
                .ToList();
            return Ok(activeIndustries);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving industry solutions");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving industry solutions.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets an industry solution by its slug.
    /// </summary>
    [HttpGet("{slug}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetBySlug(string slug)
    {
        try
        {
            var industries = await _unitOfWork.IndustrySolutions.GetAllAsync();
            var industry = industries.FirstOrDefault(i => i.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));

            if (industry == null)
            {
                return NotFound(new { detail = $"Industry solution with slug '{slug}' not found.", error_code = "NOT_FOUND" });
            }

            return Ok(industry);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving industry solution with slug {Slug}", slug);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving the industry solution.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Creates a new industry solution. Requires Admin role.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Create([FromBody] IndustrySolution industry)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid industry solution data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            await _unitOfWork.IndustrySolutions.AddAsync(industry);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetBySlug), new { slug = industry.Slug }, industry);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating industry solution");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while creating the industry solution.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Updates an existing industry solution. Requires Admin role.
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Update(int id, [FromBody] IndustrySolution industry)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid industry solution data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            var existing = await _unitOfWork.IndustrySolutions.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { detail = $"Industry solution with ID {id} not found.", error_code = "NOT_FOUND" });
            }

            existing.Title = industry.Title;
            existing.ShortDescription = industry.ShortDescription;
            existing.FullDescription = industry.FullDescription;
            existing.IconSvg = industry.IconSvg;
            existing.Slug = industry.Slug;
            existing.Challenges = industry.Challenges;
            existing.Solutions = industry.Solutions;
            existing.SortOrder = industry.SortOrder;
            existing.IsActive = industry.IsActive;

            _unitOfWork.IndustrySolutions.Update(existing);
            await _unitOfWork.SaveChangesAsync();

            return Ok(existing);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating industry solution with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while updating the industry solution.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Deletes an industry solution. Requires Admin role.
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            var existing = await _unitOfWork.IndustrySolutions.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { detail = $"Industry solution with ID {id} not found.", error_code = "NOT_FOUND" });
            }

            _unitOfWork.IndustrySolutions.Remove(existing);
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting industry solution with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while deleting the industry solution.", error_code = "INTERNAL_ERROR" });
        }
    }
}
