using System.ComponentModel.DataAnnotations;

namespace SohamYoga.Web.Models.Entities;

public class Service : BaseEntity
{
    [Required]
    [MaxLength(100)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [MaxLength(500)]
    public string ShortDescription { get; set; } = string.Empty;

    [Required]
    public string FullDescription { get; set; } = string.Empty;

    [Required]
    public string IconSvg { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Slug { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Category { get; set; } = string.Empty;

    [Required]
    public string Features { get; set; } = "[]";

    [Required]
    public int SortOrder { get; set; }

    [Required]
    public bool IsActive { get; set; } = true;

    [Required]
    public bool IsFeatured { get; set; } = false;
}
