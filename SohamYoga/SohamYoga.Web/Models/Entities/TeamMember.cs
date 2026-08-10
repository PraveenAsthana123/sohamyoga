using System.ComponentModel.DataAnnotations;

namespace SohamYoga.Web.Models.Entities;

public class TeamMember : BaseEntity
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Bio { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? ImageUrl { get; set; }

    [Required]
    public int SortOrder { get; set; }

    [Required]
    public bool IsActive { get; set; } = true;
}
