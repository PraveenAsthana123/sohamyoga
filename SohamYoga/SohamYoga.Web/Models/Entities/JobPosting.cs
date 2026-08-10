using System.ComponentModel.DataAnnotations;

namespace SohamYoga.Web.Models.Entities;

public class JobPosting : BaseEntity
{
    [Required, MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string Slug { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string Department { get; set; } = string.Empty;   // e.g. "Data Engineering"

    [Required, MaxLength(100)]
    public string Location { get; set; } = string.Empty;     // e.g. "Calgary, AB" or "Remote"

    [MaxLength(50)]
    public string EmploymentType { get; set; } = "Full-Time"; // Full-Time, Part-Time, Contract, Internship

    [MaxLength(100)]
    public string? SalaryRange { get; set; }                  // e.g. "$80,000 – $110,000"

    [Required]
    public string Description { get; set; } = string.Empty;  // Rich HTML content

    public string? Requirements { get; set; }                 // Rich HTML content

    public string? NiceToHave { get; set; }                   // Rich HTML content

    [MaxLength(500)]
    public string? Summary { get; set; }                      // Short plain-text teaser

    public bool IsActive { get; set; } = true;

    public int SortOrder { get; set; }

    public int ApplicationCount { get; set; }
}
