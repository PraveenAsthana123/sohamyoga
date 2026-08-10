using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Controllers.Api;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class ServicesController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<ServicesController> _logger;

    public ServicesController(IUnitOfWork unitOfWork, ILogger<ServicesController> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    /// <summary>
    /// Gets all active services ordered by sort order.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var services = await _unitOfWork.Services.GetAllAsync();
            var activeServices = services
                .Where(s => s.IsActive)
                .OrderBy(s => s.SortOrder)
                .ToList();
            return Ok(activeServices);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving services");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving services.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets featured services.
    /// </summary>
    [HttpGet("featured")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetFeatured()
    {
        try
        {
            var services = await _unitOfWork.Services.GetAllAsync();
            var featuredServices = services
                .Where(s => s.IsActive && s.IsFeatured)
                .OrderBy(s => s.SortOrder)
                .ToList();
            return Ok(featuredServices);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving featured services");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving featured services.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets services by category.
    /// </summary>
    [HttpGet("category/{category}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetByCategory(string category)
    {
        try
        {
            var services = await _unitOfWork.Services.GetAllAsync();
            var filteredServices = services
                .Where(s => s.IsActive && s.Category.Equals(category, StringComparison.OrdinalIgnoreCase))
                .OrderBy(s => s.SortOrder)
                .ToList();
            return Ok(filteredServices);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving services for category {Category}", category);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving services by category.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets a service by its slug.
    /// </summary>
    [HttpGet("{slug}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetBySlug(string slug)
    {
        try
        {
            var services = await _unitOfWork.Services.GetAllAsync();
            var service = services.FirstOrDefault(s => s.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));

            if (service == null)
            {
                return NotFound(new { detail = $"Service with slug '{slug}' not found.", error_code = "NOT_FOUND" });
            }

            return Ok(service);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving service with slug {Slug}", slug);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving the service.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Creates a new service. Requires Admin role.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Create([FromBody] Service service)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid service data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            await _unitOfWork.Services.AddAsync(service);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetBySlug), new { slug = service.Slug }, service);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating service");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while creating the service.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Updates an existing service. Requires Admin role.
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Update(int id, [FromBody] Service service)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid service data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            var existing = await _unitOfWork.Services.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { detail = $"Service with ID {id} not found.", error_code = "NOT_FOUND" });
            }

            existing.Title = service.Title;
            existing.ShortDescription = service.ShortDescription;
            existing.FullDescription = service.FullDescription;
            existing.IconSvg = service.IconSvg;
            existing.Slug = service.Slug;
            existing.Category = service.Category;
            existing.Features = service.Features;
            existing.SortOrder = service.SortOrder;
            existing.IsActive = service.IsActive;
            existing.IsFeatured = service.IsFeatured;

            _unitOfWork.Services.Update(existing);
            await _unitOfWork.SaveChangesAsync();

            return Ok(existing);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating service with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while updating the service.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Deletes a service. Requires Admin role.
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
            var existing = await _unitOfWork.Services.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { detail = $"Service with ID {id} not found.", error_code = "NOT_FOUND" });
            }

            _unitOfWork.Services.Remove(existing);
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting service with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while deleting the service.", error_code = "INTERNAL_ERROR" });
        }
    }
}
