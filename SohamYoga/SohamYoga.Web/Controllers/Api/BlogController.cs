using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SohamYoga.Web.Exceptions;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Services.Interfaces;

namespace SohamYoga.Web.Controllers.Api;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
public class BlogController : ControllerBase
{
    private readonly IBlogService _blogService;
    private readonly ILogger<BlogController> _logger;

    public BlogController(IBlogService blogService, ILogger<BlogController> logger)
    {
        _blogService = blogService;
        _logger = logger;
    }

    /// <summary>
    /// Gets paginated blog posts with optional filtering by category, tag, or search query.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetPosts(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 9,
        [FromQuery] int? categoryId = null,
        [FromQuery] string? tag = null,
        [FromQuery] string? search = null)
    {
        try
        {
            var (posts, total) = await _blogService.GetPublishedPostsAsync(page, pageSize, categoryId, tag, search);
            var totalPages = (int)Math.Ceiling((double)total / pageSize);

            return Ok(new
            {
                posts,
                total,
                page,
                pageSize,
                totalPages
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving blog posts");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving blog posts.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets recent blog posts.
    /// </summary>
    [HttpGet("recent")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetRecent([FromQuery] int count = 5)
    {
        try
        {
            var posts = await _blogService.GetRecentPostsAsync(count);
            return Ok(posts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving recent blog posts");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving recent blog posts.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets all blog categories.
    /// </summary>
    [HttpGet("categories")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetCategories()
    {
        try
        {
            var categories = await _blogService.GetCategoriesAsync();
            return Ok(categories);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving blog categories");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving blog categories.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets a blog post by its slug.
    /// </summary>
    [HttpGet("{slug}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetBySlug(string slug)
    {
        try
        {
            var post = await _blogService.GetPostBySlugAsync(slug);

            if (post == null)
            {
                return NotFound(new { detail = $"Blog post with slug '{slug}' not found.", error_code = "NOT_FOUND" });
            }

            return Ok(post);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving blog post with slug {Slug}", slug);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving the blog post.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Creates a new blog post. Requires Admin or Editor role.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin,Editor")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Create([FromBody] BlogPost post)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid blog post data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            var createdPost = await _blogService.CreatePostAsync(post);
            return CreatedAtAction(nameof(GetBySlug), new { slug = createdPost.Slug }, createdPost);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating blog post");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while creating the blog post.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Updates an existing blog post. Requires Admin or Editor role.
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,Editor")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Update(int id, [FromBody] BlogPost post)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid blog post data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            post.Id = id;
            var updatedPost = await _blogService.UpdatePostAsync(post);

            return Ok(updatedPost);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { detail = $"Blog post with ID {id} not found.", error_code = "NOT_FOUND" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating blog post with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while updating the blog post.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Deletes a blog post. Requires Admin role.
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
            await _blogService.DeletePostAsync(id);
            return NoContent();
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { detail = $"Blog post with ID {id} not found.", error_code = "NOT_FOUND" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting blog post with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while deleting the blog post.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Creates a new blog category. Requires Admin role.
    /// </summary>
    [HttpPost("categories")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> CreateCategory([FromBody] CreateCategoryRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid category data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            var category = await _blogService.CreateCategoryAsync(request.Name, request.Slug, request.Description);
            return CreatedAtAction(nameof(GetCategories), new { id = category.Id }, category);
        }
        catch (ConflictException ex)
        {
            return Conflict(new { detail = ex.Message, error_code = "CONFLICT" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating blog category");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while creating the blog category.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Updates an existing blog category. Requires Admin role.
    /// </summary>
    [HttpPut("categories/{id}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> UpdateCategory(int id, [FromBody] UpdateCategoryRequest request)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid category data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            var category = await _blogService.UpdateCategoryAsync(id, request.Name, request.Slug, request.Description);
            return Ok(category);
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { detail = ex.Message, error_code = "NOT_FOUND" });
        }
        catch (ConflictException ex)
        {
            return Conflict(new { detail = ex.Message, error_code = "CONFLICT" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating blog category with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while updating the blog category.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Deletes a blog category. Requires Admin role.
    /// </summary>
    [HttpDelete("categories/{id}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        try
        {
            await _blogService.DeleteCategoryAsync(id);
            return NoContent();
        }
        catch (NotFoundException ex)
        {
            return NotFound(new { detail = ex.Message, error_code = "NOT_FOUND" });
        }
        catch (ValidationException ex)
        {
            return BadRequest(new { detail = ex.Message, error_code = "VALIDATION_ERROR" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting blog category with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while deleting the blog category.", error_code = "INTERNAL_ERROR" });
        }
    }
}

public record CreateCategoryRequest(string Name, string Slug, string? Description);
public record UpdateCategoryRequest(string Name, string Slug, string? Description);
