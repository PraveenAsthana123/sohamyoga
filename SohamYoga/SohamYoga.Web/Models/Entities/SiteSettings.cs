using System.ComponentModel.DataAnnotations;

namespace SohamYoga.Web.Models.Entities;

public class SiteSettings
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public string CompanyName { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Tagline { get; set; } = string.Empty;

    [Required]
    public string Description { get; set; } = string.Empty;

    [Required]
    [MaxLength(30)]
    public string Phone { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Address { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? FacebookUrl { get; set; }

    [MaxLength(500)]
    public string? TwitterUrl { get; set; }

    [MaxLength(500)]
    public string? LinkedInUrl { get; set; }

    public string? GoogleMapsEmbed { get; set; }

    [MaxLength(200)]
    public string? SmtpHost { get; set; }

    [Required]
    public int SmtpPort { get; set; } = 587;

    [MaxLength(200)]
    public string? SmtpUsername { get; set; }

    [MaxLength(200)]
    public string? SmtpPassword { get; set; }

    [Required]
    public bool NewsletterEnabled { get; set; } = false;
}
