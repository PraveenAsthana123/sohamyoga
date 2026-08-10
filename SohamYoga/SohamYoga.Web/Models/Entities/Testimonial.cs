using System.ComponentModel.DataAnnotations;

namespace SohamYoga.Web.Models.Entities;

public class Testimonial : BaseEntity
{
    [Required]
    [MaxLength(100)]
    public string AuthorName { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string AuthorTitle { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string Company { get; set; } = string.Empty;

    [Required]
    public string Quote { get; set; } = string.Empty;

    [Required]
    [MaxLength(5)]
    public string Initials { get; set; } = string.Empty;

    [Required]
    public int Rating { get; set; } = 5;

    [Required]
    public bool IsActive { get; set; } = true;

    [Required]
    public int SortOrder { get; set; }
}
