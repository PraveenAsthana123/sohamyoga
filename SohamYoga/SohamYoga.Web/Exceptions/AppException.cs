namespace SohamYoga.Web.Exceptions;

/// <summary>
/// Base application exception with error code and HTTP status code mapping.
/// </summary>
public class AppException : Exception
{
    public string ErrorCode { get; }
    public int StatusCode { get; }

    public AppException(string message, string errorCode = "INTERNAL_ERROR", int statusCode = 500, Exception? inner = null)
        : base(message, inner)
    {
        ErrorCode = errorCode;
        StatusCode = statusCode;
    }
}

/// <summary>
/// Thrown when a requested resource is not found. Maps to HTTP 404.
/// </summary>
public class NotFoundException : AppException
{
    public NotFoundException(string message, string? errorCode = null)
        : base(message, errorCode ?? "NOT_FOUND", 404) { }
}

/// <summary>
/// Thrown when input validation fails. Maps to HTTP 400.
/// </summary>
public class ValidationException : AppException
{
    public Dictionary<string, string[]>? Errors { get; }

    public ValidationException(string message, Dictionary<string, string[]>? errors = null)
        : base(message, "VALIDATION_ERROR", 400)
    {
        Errors = errors;
    }
}

/// <summary>
/// Thrown when a resource conflict occurs (e.g. duplicate slug). Maps to HTTP 409.
/// </summary>
public class ConflictException : AppException
{
    public ConflictException(string message)
        : base(message, "CONFLICT", 409) { }
}

/// <summary>
/// Thrown when authentication is required. Maps to HTTP 401.
/// </summary>
public class UnauthorizedException : AppException
{
    public UnauthorizedException(string message = "Authentication required.")
        : base(message, "UNAUTHORIZED", 401) { }
}

/// <summary>
/// Thrown when the user lacks permission. Maps to HTTP 403.
/// </summary>
public class ForbiddenException : AppException
{
    public ForbiddenException(string message = "Access denied.")
        : base(message, "FORBIDDEN", 403) { }
}
