using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace SohamYoga.Web.Controllers.Api;

/// <summary>
/// Request model for creating a new user.
/// </summary>
public record CreateUserRequest
{
    public string Email { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
    public string Role { get; init; } = string.Empty;
}

/// <summary>
/// Request model for updating user roles.
/// </summary>
public record UpdateRolesRequest
{
    public List<string> Roles { get; init; } = new();
}

/// <summary>
/// Response model for user data.
/// </summary>
public record UserResponse
{
    public string Id { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public List<string> Roles { get; init; } = new();
    public DateTimeOffset? CreatedAt { get; init; }
}

/// <summary>
/// Admin-only controller for managing users and their roles.
/// </summary>
[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin")]
[Produces("application/json")]
public class UsersController : ControllerBase
{
    private readonly UserManager<IdentityUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly ILogger<UsersController> _logger;

    private static readonly string[] ValidRoles = { "Admin", "Editor", "HR", "Sales" };

    public UsersController(
        UserManager<IdentityUser> userManager,
        RoleManager<IdentityRole> roleManager,
        ILogger<UsersController> logger)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _logger = logger;
    }

    /// <summary>
    /// Gets all users with their roles. Requires Admin role.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetAll()
    {
        try
        {
            var users = await _userManager.Users.ToListAsync();
            var userResponses = new List<UserResponse>();

            foreach (var user in users)
            {
                var roles = await _userManager.GetRolesAsync(user);
                userResponses.Add(new UserResponse
                {
                    Id = user.Id,
                    Email = user.Email ?? string.Empty,
                    Roles = roles.ToList(),
                    CreatedAt = user.LockoutEnd // IdentityUser doesn't have CreatedAt; using LockoutEnd as placeholder
                });
            }

            return Ok(userResponses);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving users");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving users.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Creates a new user with a specified role. Requires Admin role.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                return BadRequest(new { detail = "Email is required.", error_code = "VALIDATION_ERROR" });
            }

            if (string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new { detail = "Password is required.", error_code = "VALIDATION_ERROR" });
            }

            if (string.IsNullOrWhiteSpace(request.Role))
            {
                return BadRequest(new { detail = "Role is required.", error_code = "VALIDATION_ERROR" });
            }

            if (!ValidRoles.Contains(request.Role))
            {
                return BadRequest(new { detail = $"Invalid role '{request.Role}'. Valid roles: {string.Join(", ", ValidRoles)}.", error_code = "VALIDATION_ERROR" });
            }

            // Ensure the role exists
            if (!await _roleManager.RoleExistsAsync(request.Role))
            {
                await _roleManager.CreateAsync(new IdentityRole(request.Role));
            }

            var user = new IdentityUser
            {
                UserName = request.Email,
                Email = request.Email,
                EmailConfirmed = true
            };

            var result = await _userManager.CreateAsync(user, request.Password);
            if (!result.Succeeded)
            {
                var errors = string.Join("; ", result.Errors.Select(e => e.Description));
                return BadRequest(new { detail = errors, error_code = "VALIDATION_ERROR" });
            }

            await _userManager.AddToRoleAsync(user, request.Role);

            var roles = await _userManager.GetRolesAsync(user);
            var response = new UserResponse
            {
                Id = user.Id,
                Email = user.Email ?? string.Empty,
                Roles = roles.ToList()
            };

            _logger.LogInformation("User {Email} created with role {Role} by {Admin}", request.Email, request.Role, User.Identity?.Name);

            return CreatedAtAction(nameof(GetAll), response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating user {Email}", request.Email);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while creating the user.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Updates the roles for a specific user. Requires Admin role.
    /// </summary>
    [HttpPut("{id}/roles")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> UpdateRoles(string id, [FromBody] UpdateRolesRequest request)
    {
        try
        {
            if (request.Roles == null || request.Roles.Count == 0)
            {
                return BadRequest(new { detail = "At least one role is required.", error_code = "VALIDATION_ERROR" });
            }

            var invalidRoles = request.Roles.Where(r => !ValidRoles.Contains(r)).ToList();
            if (invalidRoles.Count > 0)
            {
                return BadRequest(new { detail = $"Invalid roles: {string.Join(", ", invalidRoles)}. Valid roles: {string.Join(", ", ValidRoles)}.", error_code = "VALIDATION_ERROR" });
            }

            var user = await _userManager.FindByIdAsync(id);
            if (user == null)
            {
                return NotFound(new { detail = $"User with ID '{id}' not found.", error_code = "NOT_FOUND" });
            }

            // Ensure all requested roles exist
            foreach (var role in request.Roles)
            {
                if (!await _roleManager.RoleExistsAsync(role))
                {
                    await _roleManager.CreateAsync(new IdentityRole(role));
                }
            }

            // Remove all current roles and assign new ones
            var currentRoles = await _userManager.GetRolesAsync(user);
            await _userManager.RemoveFromRolesAsync(user, currentRoles);
            await _userManager.AddToRolesAsync(user, request.Roles);

            _logger.LogInformation("Roles updated for user {Email} to [{Roles}] by {Admin}",
                user.Email, string.Join(", ", request.Roles), User.Identity?.Name);

            return Ok(new { detail = "User roles updated successfully." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating roles for user {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while updating user roles.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Deletes a user. Cannot delete yourself. Requires Admin role.
    /// </summary>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Delete(string id)
    {
        try
        {
            var user = await _userManager.FindByIdAsync(id);
            if (user == null)
            {
                return NotFound(new { detail = $"User with ID '{id}' not found.", error_code = "NOT_FOUND" });
            }

            // Prevent self-deletion
            var currentUser = await _userManager.GetUserAsync(User);
            if (currentUser != null && currentUser.Id == id)
            {
                return BadRequest(new { detail = "You cannot delete your own account.", error_code = "SELF_DELETE_FORBIDDEN" });
            }

            var result = await _userManager.DeleteAsync(user);
            if (!result.Succeeded)
            {
                var errors = string.Join("; ", result.Errors.Select(e => e.Description));
                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { detail = $"Failed to delete user: {errors}", error_code = "DELETE_FAILED" });
            }

            _logger.LogInformation("User {Email} (ID: {Id}) deleted by {Admin}", user.Email, id, User.Identity?.Name);

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting user {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while deleting the user.", error_code = "INTERNAL_ERROR" });
        }
    }
}
