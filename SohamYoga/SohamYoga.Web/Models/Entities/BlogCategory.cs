using System.ComponentModel.DataAnnotations;

namespace SohamYoga.Web.Models.Entities;

public class BlogCategory : BaseEntity
{
    [Required]
    [MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(50)]
    public string Slug { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    public ICollection<BlogPost> Posts { get; set; } = new List<BlogPost>();
}
