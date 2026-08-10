using System.ComponentModel.DataAnnotations;

namespace SohamYoga.Web.Models.Entities;

public class NewsletterSubscriber : BaseEntity
{
    [Required]
    [MaxLength(200)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Name { get; set; }

    [Required]
    public bool IsActive { get; set; } = true;

    [Required]
    [MaxLength(100)]
    public string Token { get; set; } = string.Empty;

    [Required]
    public DateTime SubscribedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UnsubscribedAt { get; set; }
}
