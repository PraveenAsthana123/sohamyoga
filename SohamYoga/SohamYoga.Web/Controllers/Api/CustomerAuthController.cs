using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace SohamYoga.Web.Controllers.Api;

public record CustomerRegisterRequest
{
    public string Name { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
}

[ApiController]
[Route("api/customer/auth")]
[Produces("application/json")]
public class CustomerAuthController : ControllerBase
{
    private readonly UserManager<IdentityUser> _userManager;
    private readonly SignInManager<IdentityUser> _signInManager;
    private readonly ILogger<CustomerAuthController> _logger;

    public CustomerAuthController(
        UserManager<IdentityUser> userManager,
        SignInManager<IdentityUser> signInManager,
        ILogger<CustomerAuthController> logger)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _logger = logger;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] CustomerRegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { detail = "Name, email and password are required.", error_code = "VALIDATION_ERROR" });
        }

        var existing = await _userManager.FindByEmailAsync(request.Email);
        if (existing != null)
            return Conflict(new { detail = "An account with this email already exists.", error_code = "EMAIL_TAKEN" });

        var user = new IdentityUser
        {
            UserName = request.Email,
            Email = request.Email,
            EmailConfirmed = true
        };

        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description);
            return BadRequest(new { detail = string.Join(" ", errors), error_code = "REGISTRATION_FAILED" });
        }

        await _userManager.AddToRoleAsync(user, "Customer");
        await _userManager.AddClaimAsync(user, new System.Security.Claims.Claim("DisplayName", request.Name));

        await _signInManager.SignInAsync(user, isPersistent: false);

        _logger.LogInformation("Customer registered: {Email}", request.Email);

        return Ok(new
        {
            detail = "Registration successful.",
            user = new { id = user.Id, email = user.Email, name = request.Name, roles = new[] { "Customer" } }
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { detail = "Email and password are required.", error_code = "VALIDATION_ERROR" });

        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user == null)
            return Unauthorized(new { detail = "Invalid email or password.", error_code = "INVALID_CREDENTIALS" });

        // Only allow Customer role users on this endpoint
        if (!await _userManager.IsInRoleAsync(user, "Customer"))
            return Unauthorized(new { detail = "Invalid email or password.", error_code = "INVALID_CREDENTIALS" });

        var result = await _signInManager.PasswordSignInAsync(user, request.Password, isPersistent: false, lockoutOnFailure: true);
        if (!result.Succeeded)
        {
            if (result.IsLockedOut)
                return Unauthorized(new { detail = "Account locked. Try again later.", error_code = "ACCOUNT_LOCKED" });
            return Unauthorized(new { detail = "Invalid email or password.", error_code = "INVALID_CREDENTIALS" });
        }

        var claims = await _userManager.GetClaimsAsync(user);
        var displayName = claims.FirstOrDefault(c => c.Type == "DisplayName")?.Value ?? user.Email;

        _logger.LogInformation("Customer logged in: {Email}", request.Email);

        return Ok(new
        {
            detail = "Login successful.",
            user = new { id = user.Id, email = user.Email, name = displayName, roles = new[] { "Customer" } }
        });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        return Ok(new { detail = "Logged out." });
    }

    [HttpGet("me")]
    [Authorize(Roles = "Customer")]
    public async Task<IActionResult> Me()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user == null)
            return Unauthorized(new { detail = "Not authenticated.", error_code = "NOT_AUTHENTICATED" });

        var claims = await _userManager.GetClaimsAsync(user);
        var displayName = claims.FirstOrDefault(c => c.Type == "DisplayName")?.Value ?? user.Email;

        return Ok(new { id = user.Id, email = user.Email, name = displayName, roles = new[] { "Customer" } });
    }
}
