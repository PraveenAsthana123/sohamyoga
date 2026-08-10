using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Controllers.Api;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class VideosController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<VideosController> _logger;

    public VideosController(IUnitOfWork unitOfWork, ILogger<VideosController> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    /// <summary>
    /// Gets all active video demos ordered by sort order.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var videos = await _unitOfWork.VideoDemos.GetAllAsync();
            var activeVideos = videos
                .Where(v => v.IsActive)
                .OrderBy(v => v.SortOrder)
                .ToList();
            return Ok(activeVideos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving video demos");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving video demos.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets video demos by category.
    /// </summary>
    [HttpGet("category/{category}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetByCategory(string category)
    {
        try
        {
            var videos = await _unitOfWork.VideoDemos.GetAllAsync();
            var filteredVideos = videos
                .Where(v => v.IsActive && v.Category.Equals(category, StringComparison.OrdinalIgnoreCase))
                .OrderBy(v => v.SortOrder)
                .ToList();
            return Ok(filteredVideos);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving video demos for category {Category}", category);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving video demos by category.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets a video demo by ID.
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetById(int id)
    {
        try
        {
            var video = await _unitOfWork.VideoDemos.GetByIdAsync(id);
            if (video == null)
            {
                return NotFound(new { detail = $"Video demo with ID {id} not found.", error_code = "NOT_FOUND" });
            }

            return Ok(video);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving video demo with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving the video demo.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Creates a new video demo. Requires Admin role.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Create([FromBody] VideoDemo video)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid video demo data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            await _unitOfWork.VideoDemos.AddAsync(video);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = video.Id }, video);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating video demo");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while creating the video demo.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Updates an existing video demo. Requires Admin role.
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Update(int id, [FromBody] VideoDemo video)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid video demo data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            var existing = await _unitOfWork.VideoDemos.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { detail = $"Video demo with ID {id} not found.", error_code = "NOT_FOUND" });
            }

            existing.Title = video.Title;
            existing.Description = video.Description;
            existing.VideoUrl = video.VideoUrl;
            existing.ThumbnailUrl = video.ThumbnailUrl;
            existing.Duration = video.Duration;
            existing.Category = video.Category;
            existing.IsActive = video.IsActive;
            existing.SortOrder = video.SortOrder;

            _unitOfWork.VideoDemos.Update(existing);
            await _unitOfWork.SaveChangesAsync();

            return Ok(existing);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating video demo with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while updating the video demo.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Deletes a video demo. Requires Admin role.
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
            var existing = await _unitOfWork.VideoDemos.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { detail = $"Video demo with ID {id} not found.", error_code = "NOT_FOUND" });
            }

            _unitOfWork.VideoDemos.Remove(existing);
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting video demo with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while deleting the video demo.", error_code = "INTERNAL_ERROR" });
        }
    }
}
