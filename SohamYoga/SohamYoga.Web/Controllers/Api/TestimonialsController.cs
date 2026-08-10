using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Controllers.Api;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class TestimonialsController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<TestimonialsController> _logger;

    public TestimonialsController(IUnitOfWork unitOfWork, ILogger<TestimonialsController> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    /// <summary>
    /// Gets all active testimonials ordered by sort order.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var testimonials = await _unitOfWork.Testimonials.GetAllAsync();
            var activeTestimonials = testimonials
                .Where(t => t.IsActive)
                .OrderBy(t => t.SortOrder)
                .ToList();
            return Ok(activeTestimonials);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving testimonials");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving testimonials.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets a testimonial by ID.
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetById(int id)
    {
        try
        {
            var testimonial = await _unitOfWork.Testimonials.GetByIdAsync(id);
            if (testimonial == null)
            {
                return NotFound(new { detail = $"Testimonial with ID {id} not found.", error_code = "NOT_FOUND" });
            }

            return Ok(testimonial);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving testimonial with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving the testimonial.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Creates a new testimonial. Requires Admin role.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Create([FromBody] Testimonial testimonial)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid testimonial data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            await _unitOfWork.Testimonials.AddAsync(testimonial);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = testimonial.Id }, testimonial);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating testimonial");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while creating the testimonial.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Updates an existing testimonial. Requires Admin role.
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Update(int id, [FromBody] Testimonial testimonial)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid testimonial data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            var existing = await _unitOfWork.Testimonials.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { detail = $"Testimonial with ID {id} not found.", error_code = "NOT_FOUND" });
            }

            existing.AuthorName = testimonial.AuthorName;
            existing.AuthorTitle = testimonial.AuthorTitle;
            existing.Company = testimonial.Company;
            existing.Quote = testimonial.Quote;
            existing.Initials = testimonial.Initials;
            existing.Rating = testimonial.Rating;
            existing.IsActive = testimonial.IsActive;
            existing.SortOrder = testimonial.SortOrder;

            _unitOfWork.Testimonials.Update(existing);
            await _unitOfWork.SaveChangesAsync();

            return Ok(existing);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating testimonial with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while updating the testimonial.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Deletes a testimonial. Requires Admin role.
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
            var existing = await _unitOfWork.Testimonials.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { detail = $"Testimonial with ID {id} not found.", error_code = "NOT_FOUND" });
            }

            _unitOfWork.Testimonials.Remove(existing);
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting testimonial with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while deleting the testimonial.", error_code = "INTERNAL_ERROR" });
        }
    }
}
