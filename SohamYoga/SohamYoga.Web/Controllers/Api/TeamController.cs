using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Controllers.Api;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class TeamController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<TeamController> _logger;

    public TeamController(IUnitOfWork unitOfWork, ILogger<TeamController> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    /// <summary>
    /// Gets all active team members ordered by sort order.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var members = await _unitOfWork.TeamMembers.GetAllAsync();
            var activeMembers = members
                .Where(m => m.IsActive)
                .OrderBy(m => m.SortOrder)
                .ToList();
            return Ok(activeMembers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving team members");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving team members.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets a team member by ID.
    /// </summary>
    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetById(int id)
    {
        try
        {
            var member = await _unitOfWork.TeamMembers.GetByIdAsync(id);
            if (member == null)
            {
                return NotFound(new { detail = $"Team member with ID {id} not found.", error_code = "NOT_FOUND" });
            }

            return Ok(member);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving team member with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving the team member.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Creates a new team member. Requires Admin or HR role.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin,HR")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Create([FromBody] TeamMember member)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid team member data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            await _unitOfWork.TeamMembers.AddAsync(member);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = member.Id }, member);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating team member");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while creating the team member.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Updates an existing team member. Requires Admin or HR role.
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,HR")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Update(int id, [FromBody] TeamMember member)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid team member data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            var existing = await _unitOfWork.TeamMembers.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { detail = $"Team member with ID {id} not found.", error_code = "NOT_FOUND" });
            }

            existing.Name = member.Name;
            existing.Title = member.Title;
            existing.Bio = member.Bio;
            existing.ImageUrl = member.ImageUrl;
            existing.SortOrder = member.SortOrder;
            existing.IsActive = member.IsActive;

            _unitOfWork.TeamMembers.Update(existing);
            await _unitOfWork.SaveChangesAsync();

            return Ok(existing);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating team member with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while updating the team member.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Deletes a team member. Requires Admin or HR role.
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,HR")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            var existing = await _unitOfWork.TeamMembers.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { detail = $"Team member with ID {id} not found.", error_code = "NOT_FOUND" });
            }

            _unitOfWork.TeamMembers.Remove(existing);
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting team member with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while deleting the team member.", error_code = "INTERNAL_ERROR" });
        }
    }
}
