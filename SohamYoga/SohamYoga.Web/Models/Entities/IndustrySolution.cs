using System.ComponentModel.DataAnnotations;

namespace SohamYoga.Web.Models.Entities;

public class IndustrySolution : BaseEntity
{
    [Required]
    [MaxLength(100)]
    public string Title { get; set; } = string.Empty;

    [Required]
    [MaxLength(300)]
    public string ShortDescription { get; set; } = string.Empty;

    [Required]
    public string FullDescription { get; set; } = string.Empty;

    [Required]
    public string IconSvg { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Slug { get; set; } = string.Empty;

    [Required]
    public string Challenges { get; set; } = "[]";

    [Required]
    public string Solutions { get; set; } = "[]";

    [Required]
    public int SortOrder { get; set; }

    [Required]
    public bool IsActive { get; set; } = true;
}
