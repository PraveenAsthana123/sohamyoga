using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Controllers.Api;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class CaseStudiesController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<CaseStudiesController> _logger;

    public CaseStudiesController(IUnitOfWork unitOfWork, ILogger<CaseStudiesController> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    /// <summary>
    /// Gets all active case studies ordered by sort order.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var caseStudies = await _unitOfWork.CaseStudies.GetAllAsync();
            var activeCaseStudies = caseStudies
                .Where(cs => cs.IsActive)
                .OrderBy(cs => cs.SortOrder)
                .ToList();
            return Ok(activeCaseStudies);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving case studies");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving case studies.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets a case study by its slug.
    /// </summary>
    [HttpGet("{slug}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetBySlug(string slug)
    {
        try
        {
            var caseStudies = await _unitOfWork.CaseStudies.GetAllAsync();
            var caseStudy = caseStudies.FirstOrDefault(cs => cs.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));

            if (caseStudy == null)
            {
                return NotFound(new { detail = $"Case study with slug '{slug}' not found.", error_code = "NOT_FOUND" });
            }

            return Ok(caseStudy);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving case study with slug {Slug}", slug);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving the case study.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Creates a new case study. Requires Admin role.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Create([FromBody] CaseStudy caseStudy)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid case study data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            await _unitOfWork.CaseStudies.AddAsync(caseStudy);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetBySlug), new { slug = caseStudy.Slug }, caseStudy);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating case study");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while creating the case study.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Updates an existing case study. Requires Admin role.
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Update(int id, [FromBody] CaseStudy caseStudy)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid case study data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            var existing = await _unitOfWork.CaseStudies.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { detail = $"Case study with ID {id} not found.", error_code = "NOT_FOUND" });
            }

            existing.Title = caseStudy.Title;
            existing.Description = caseStudy.Description;
            existing.FullContent = caseStudy.FullContent;
            existing.Tag = caseStudy.Tag;
            existing.GradientFrom = caseStudy.GradientFrom;
            existing.GradientTo = caseStudy.GradientTo;
            existing.IconSvg = caseStudy.IconSvg;
            existing.Slug = caseStudy.Slug;
            existing.IsActive = caseStudy.IsActive;
            existing.SortOrder = caseStudy.SortOrder;

            _unitOfWork.CaseStudies.Update(existing);
            await _unitOfWork.SaveChangesAsync();

            return Ok(existing);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating case study with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while updating the case study.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Deletes a case study. Requires Admin role.
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
            var existing = await _unitOfWork.CaseStudies.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { detail = $"Case study with ID {id} not found.", error_code = "NOT_FOUND" });
            }

            _unitOfWork.CaseStudies.Remove(existing);
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting case study with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while deleting the case study.", error_code = "INTERNAL_ERROR" });
        }
    }
}
