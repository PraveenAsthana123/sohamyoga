using System.ComponentModel.DataAnnotations;

namespace SohamYoga.Web.Models.Entities;

public class YogaProduct : BaseEntity
{
    [Required][MaxLength(200)]
    public string Name { get; set; } = string.Empty;

    [Required][MaxLength(500)]
    public string ShortDescription { get; set; } = string.Empty;

    [Required]
    public string FullDescription { get; set; } = string.Empty;

    [Required]
    public decimal Price { get; set; }

    public decimal? DiscountPrice { get; set; }

    [MaxLength(500)]
    public string ImageUrl { get; set; } = string.Empty;

    [Required][MaxLength(100)]
    public string Slug { get; set; } = string.Empty;

    [Required][MaxLength(50)]
    public string Category { get; set; } = string.Empty;

    [MaxLength(100)]
    public string Brand { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Sku { get; set; } = string.Empty;

    public int StockQuantity { get; set; } = 0;

    public bool IsActive { get; set; } = true;

    public bool IsFeatured { get; set; } = false;

    public int SortOrder { get; set; }

    public double Rating { get; set; } = 0;

    public int ReviewCount { get; set; } = 0;

    [MaxLength(200)]
    public string Tags { get; set; } = string.Empty;
}
