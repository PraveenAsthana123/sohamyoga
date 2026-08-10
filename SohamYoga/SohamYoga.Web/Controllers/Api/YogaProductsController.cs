using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Controllers.Api;

[ApiController]
[Route("api/yoga-products")]
[Produces("application/json")]
public class YogaProductsController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<YogaProductsController> _logger;

    public YogaProductsController(IUnitOfWork unitOfWork, ILogger<YogaProductsController> logger)
    {
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    /// <summary>
    /// Gets all active yoga products, with optional category filter.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetAll([FromQuery] string? category = null)
    {
        try
        {
            var products = await _unitOfWork.YogaProducts.GetAllAsync();
            var activeProducts = products
                .Where(p => p.IsActive);

            if (!string.IsNullOrWhiteSpace(category))
            {
                activeProducts = activeProducts
                    .Where(p => p.Category.Equals(category, StringComparison.OrdinalIgnoreCase));
            }

            var result = activeProducts
                .OrderBy(p => p.SortOrder)
                .ToList();

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving yoga products");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving yoga products.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets featured yoga products.
    /// </summary>
    [HttpGet("featured")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetFeatured()
    {
        try
        {
            var products = await _unitOfWork.YogaProducts.GetAllAsync();
            var featuredProducts = products
                .Where(p => p.IsActive && p.IsFeatured)
                .OrderBy(p => p.SortOrder)
                .ToList();
            return Ok(featuredProducts);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving featured yoga products");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving featured yoga products.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Gets a yoga product by its slug.
    /// </summary>
    [HttpGet("{slug}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetBySlug(string slug)
    {
        try
        {
            var products = await _unitOfWork.YogaProducts.GetAllAsync();
            var product = products.FirstOrDefault(p => p.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));

            if (product == null)
            {
                return NotFound(new { detail = $"Yoga product with slug '{slug}' not found.", error_code = "NOT_FOUND" });
            }

            return Ok(product);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving yoga product with slug {Slug}", slug);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving the yoga product.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Creates a new yoga product. Requires Admin role.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Create([FromBody] YogaProduct product)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid yoga product data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            await _unitOfWork.YogaProducts.AddAsync(product);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetBySlug), new { slug = product.Slug }, product);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating yoga product");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while creating the yoga product.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Updates an existing yoga product. Requires Admin role.
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Update(int id, [FromBody] YogaProduct product)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { detail = "Invalid yoga product data.", error_code = "VALIDATION_ERROR", errors = ModelState });
            }

            var existing = await _unitOfWork.YogaProducts.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { detail = $"Yoga product with ID {id} not found.", error_code = "NOT_FOUND" });
            }

            existing.Name = product.Name;
            existing.ShortDescription = product.ShortDescription;
            existing.FullDescription = product.FullDescription;
            existing.Price = product.Price;
            existing.DiscountPrice = product.DiscountPrice;
            existing.ImageUrl = product.ImageUrl;
            existing.Slug = product.Slug;
            existing.Category = product.Category;
            existing.Brand = product.Brand;
            existing.Sku = product.Sku;
            existing.StockQuantity = product.StockQuantity;
            existing.IsActive = product.IsActive;
            existing.IsFeatured = product.IsFeatured;
            existing.SortOrder = product.SortOrder;
            existing.Rating = product.Rating;
            existing.ReviewCount = product.ReviewCount;
            existing.Tags = product.Tags;

            _unitOfWork.YogaProducts.Update(existing);
            await _unitOfWork.SaveChangesAsync();

            return Ok(existing);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating yoga product with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while updating the yoga product.", error_code = "INTERNAL_ERROR" });
        }
    }

    /// <summary>
    /// Deletes a yoga product. Requires Admin role.
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
            var existing = await _unitOfWork.YogaProducts.GetByIdAsync(id);
            if (existing == null)
            {
                return NotFound(new { detail = $"Yoga product with ID {id} not found.", error_code = "NOT_FOUND" });
            }

            _unitOfWork.YogaProducts.Remove(existing);
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting yoga product with ID {Id}", id);
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while deleting the yoga product.", error_code = "INTERNAL_ERROR" });
        }
    }
}
