using System.ComponentModel.DataAnnotations;

namespace SohamYoga.Web.Models.Entities;

public class JobApplication : BaseEntity
{
    public int JobPostingId { get; set; }
    public JobPosting? JobPosting { get; set; }

    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(200), EmailAddress]
    public string Email { get; set; } = string.Empty;

    [MaxLength(30)]
    public string? Phone { get; set; }

    [MaxLength(200)]
    public string? LinkedInUrl { get; set; }

    [MaxLength(200)]
    public string? PortfolioUrl { get; set; }

    public string? CoverLetter { get; set; }

    [MaxLength(500)]
    public string? AdminNotes { get; set; }

    [MaxLength(50)]
    public string Status { get; set; } = "New";  // New, Reviewed, Shortlisted, Rejected
}
