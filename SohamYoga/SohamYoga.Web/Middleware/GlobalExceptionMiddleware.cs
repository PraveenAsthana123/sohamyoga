using System.Net;
using System.Text.Json;
using SohamYoga.Web.Exceptions;

namespace SohamYoga.Web.Middleware;

/// <summary>
/// Global exception handler middleware. Catches all unhandled exceptions and returns
/// a consistent error envelope: { detail, error_code, correlation_id }.
/// </summary>
public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var correlationId = context.Items["CorrelationId"]?.ToString() ?? "N/A";

        int statusCode;
        string errorCode;
        string detail;
        object? errors = null;

        switch (exception)
        {
            case AppException appEx:
                statusCode = appEx.StatusCode;
                errorCode = appEx.ErrorCode;
                detail = appEx.Message;
                if (appEx is Exceptions.ValidationException validationEx)
                    errors = validationEx.Errors;
                _logger.LogWarning(exception, "Application exception [{ErrorCode}]: {Detail} (CorrelationId: {CorrelationId})",
                    errorCode, detail, correlationId);
                break;

            case KeyNotFoundException:
                statusCode = (int)HttpStatusCode.NotFound;
                errorCode = "NOT_FOUND";
                detail = exception.Message;
                _logger.LogWarning("Resource not found: {Detail} (CorrelationId: {CorrelationId})", detail, correlationId);
                break;

            case UnauthorizedAccessException:
                statusCode = (int)HttpStatusCode.Unauthorized;
                errorCode = "UNAUTHORIZED";
                detail = "Authentication required.";
                _logger.LogWarning("Unauthorized access attempt (CorrelationId: {CorrelationId})", correlationId);
                break;

            case OperationCanceledException:
                statusCode = 499; // Client Closed Request
                errorCode = "REQUEST_CANCELLED";
                detail = "The request was cancelled.";
                _logger.LogInformation("Request cancelled (CorrelationId: {CorrelationId})", correlationId);
                break;

            default:
                statusCode = (int)HttpStatusCode.InternalServerError;
                errorCode = "INTERNAL_ERROR";
                detail = "An unexpected error occurred. Please try again later.";
                _logger.LogError(exception, "Unhandled exception (CorrelationId: {CorrelationId})", correlationId);
                break;
        }

        if (context.Response.HasStarted)
        {
            _logger.LogWarning("Response already started, cannot write error response for {ErrorCode}", errorCode);
            return;
        }

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";

        var response = new Dictionary<string, object?>
        {
            { "detail", detail },
            { "error_code", errorCode },
            { "correlation_id", correlationId }
        };

        if (errors != null)
            response["errors"] = errors;

        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await context.Response.WriteAsync(json);
    }
}
