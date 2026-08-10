using System.ComponentModel.DataAnnotations;

namespace SohamYoga.Web.Models.Entities;

/// <summary>
/// Tracks admin actions for compliance and debugging. Auto-purged after 90 days.
/// </summary>
public class AuditLog : BaseEntity
{
    [Required, MaxLength(100)]
    public string Action { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string EntityType { get; set; } = string.Empty;

    public int? EntityId { get; set; }

    [MaxLength(450)]
    public string? UserId { get; set; }

    [MaxLength(256)]
    public string? UserEmail { get; set; }

    /// <summary>
    /// JSON-serialized details of the change (old/new values).
    /// </summary>
    public string? Details { get; set; }

    [MaxLength(45)]
    public string? IpAddress { get; set; }

    [MaxLength(36)]
    public string? CorrelationId { get; set; }
}
