using System.ComponentModel.DataAnnotations;

namespace SohamYoga.Web.Models.Entities;

public class ChatMessage : BaseEntity
{
    [Required]
    [MaxLength(100)]
    public string SessionId { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string SenderName { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? SenderEmail { get; set; }

    [Required]
    public string Content { get; set; } = string.Empty;

    /// <summary>true = sent by admin, false = sent by customer</summary>
    public bool IsFromAdmin { get; set; }

    public bool IsRead { get; set; }

    /// <summary>IdentityUser.Id of the customer, null for anonymous sessions</summary>
    [MaxLength(450)]
    public string? CustomerId { get; set; }
}
