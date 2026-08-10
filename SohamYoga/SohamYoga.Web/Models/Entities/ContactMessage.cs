using System.ComponentModel.DataAnnotations;

namespace SohamYoga.Web.Models.Entities;

public class ContactMessage : BaseEntity
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(30)]
    public string? Phone { get; set; }

    [MaxLength(100)]
    public string? Company { get; set; }

    [Required]
    [MaxLength(200)]
    public string Subject { get; set; } = string.Empty;

    [Required]
    public string Message { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? ServiceInterest { get; set; }

    [Required]
    public bool IsRead { get; set; } = false;

    [Required]
    public bool IsArchived { get; set; } = false;

    public DateTime? RepliedAt { get; set; }
}
