using System.ComponentModel.DataAnnotations;

namespace SohamYoga.Web.Models.Entities;

public class ChatRequest : BaseEntity
{
    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [MaxLength(30)]
    public string? Phone { get; set; }

    [MaxLength(100)]
    public string? Company { get; set; }

    [Required]
    [MaxLength(100)]
    public string RequestType { get; set; } = string.Empty; // "General Inquiry", "Demo Request", "Consultation", "Support"

    [Required]
    public string Message { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? ServiceInterest { get; set; }

    [MaxLength(50)]
    public string? Priority { get; set; } = "Normal"; // "Low", "Normal", "High", "Urgent"

    public bool IsResolved { get; set; } = false;

    [MaxLength(500)]
    public string? AdminNotes { get; set; }

    public DateTime? ResolvedAt { get; set; }

    [MaxLength(100)]
    public string? AssignedTo { get; set; }
}
