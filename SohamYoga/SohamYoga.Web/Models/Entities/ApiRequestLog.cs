using System.ComponentModel.DataAnnotations;

namespace SohamYoga.Web.Models.Entities;

/// <summary>
/// Tracks every API request for performance monitoring and debugging. Auto-purged after 30 days.
/// </summary>
public class ApiRequestLog : BaseEntity
{
    [Required, MaxLength(10)]
    public string Method { get; set; } = string.Empty;

    [Required, MaxLength(2048)]
    public string Path { get; set; } = string.Empty;

    public int StatusCode { get; set; }

    public long DurationMs { get; set; }

    [MaxLength(45)]
    public string? ClientIp { get; set; }

    [MaxLength(512)]
    public string? UserAgent { get; set; }

    [MaxLength(450)]
    public string? UserId { get; set; }

    [MaxLength(36)]
    public string? CorrelationId { get; set; }

    [MaxLength(2048)]
    public string? QueryString { get; set; }
}
