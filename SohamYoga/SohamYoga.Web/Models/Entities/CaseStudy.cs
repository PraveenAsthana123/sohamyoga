using System.ComponentModel.DataAnnotations;

namespace SohamYoga.Web.Models.Entities;

public class CaseStudy : BaseEntity
{
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Description { get; set; } = string.Empty;

    [Required]
    public string FullContent { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Tag { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string GradientFrom { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string GradientTo { get; set; } = string.Empty;

    [Required]
    public string IconSvg { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Slug { get; set; } = string.Empty;

    [Required]
    public bool IsActive { get; set; } = true;

    [Required]
    public int SortOrder { get; set; }
}
