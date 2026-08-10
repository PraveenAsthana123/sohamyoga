using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace SohamYoga.Web.Controllers.Api;

/// <summary>
/// Request model for user login.
/// </summary>
public record LoginRequest
{
    public string Email { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
}

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly UserManager<IdentityUser> _userManager;
    private readonly SignInManager<IdentityUser> _signInManager;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        UserManager<IdentityUser> userManager,
        SignInManager<IdentityUser> signInManager,
        ILogger<AuthController> logger)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _logger = logger;
    }

    /// <summary>
    /// Authenticates a user with email and password.
    /// </summary>
    [HttpPost("login")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
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

            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user == null)
            {
                return Unauthorized(new { detail = "Invalid email or password.", error_code = "INVALID_CREDENTIALS" });
            }

            var result = await _signInManager.PasswordSignInAsync(user, request.Password, isPersistent: false, lockoutOnFailure: true);

            if (!result.Succeeded)
            {
                if (result.IsLockedOut)
                {
                    _logger.LogWarning("User account {Email} is locked out", request.Email);
                    return Unauthorized(new { detail = "Account is locked out. Please try again later.", error_code = "ACCOUNT_LOCKED" });
                }

                if (result.IsNotAllowed)
                {
                    return Unauthorized(new { detail = "Account is not allowed to sign in.", error_code = "SIGN_IN_NOT_ALLOWED" });
                }

                return Unauthorized(new { detail = "Invalid email or password.", error_code = "INVALID_CREDENTIALS" });
            }

            var roles = await _userManager.GetRolesAsync(user);

            _logger.LogInformation("User {Email} logged in successfully", request.Email);

            return Ok(new
            {
                detail = "Login successful.",
                user = new
                {
                    id = user.Id,
                    email = user.Email,
                    userName = user.UserName,
                    roles
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during login for {Email}", request.Email);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred during login.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Signs out the current user.
    /// </summary>
    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Logout()
    {
        try
        {
            await _signInManager.SignOutAsync();
            _logger.LogInformation("User logged out");
            return Ok(new { detail = "Logout successful." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during logout");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred during logout.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets the currently authenticated user's information.
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetCurrentUser()
    {
        try
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null)
            {
                return Unauthorized(new { detail = "User not found.", error_code = "NOT_AUTHENTICATED" });
            }

            var roles = await _userManager.GetRolesAsync(user);

            return Ok(new
            {
                id = user.Id,
                email = user.Email,
                userName = user.UserName,
                roles
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving current user information");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving user information.", error_code = "INTERNAL_ERROR" });
        }
    }
}
