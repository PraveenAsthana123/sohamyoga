using System.Collections.Concurrent;
using System.Net;

namespace SohamYoga.Web.Middleware;

public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RateLimitingMiddleware> _logger;
    private readonly int _maxRequests;
    private readonly TimeSpan _window;
    private readonly ConcurrentDictionary<string, ClientRequestInfo> _clients = new();
    private DateTime _lastCleanup = DateTime.UtcNow;
    private readonly TimeSpan _cleanupInterval = TimeSpan.FromMinutes(5);

    public RateLimitingMiddleware(
        RequestDelegate next,
        ILogger<RateLimitingMiddleware> logger,
        int maxRequests = 100,
        int windowSeconds = 60)
    {
        _next = next;
        _logger = logger;
        _maxRequests = maxRequests;
        _window = TimeSpan.FromSeconds(windowSeconds);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var clientIp = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var now = DateTime.UtcNow;

        // Periodic cleanup of stale entries to prevent memory leak
        if (now - _lastCleanup > _cleanupInterval)
        {
            _lastCleanup = now;
            foreach (var kvp in _clients)
            {
                lock (kvp.Value)
                {
                    kvp.Value.Requests.RemoveAll(t => now - t > _window);
                    if (kvp.Value.Requests.Count == 0)
                        _clients.TryRemove(kvp.Key, out _);
                }
            }
        }

        var clientInfo = _clients.GetOrAdd(clientIp, _ => new ClientRequestInfo());

        lock (clientInfo)
        {
            clientInfo.Requests.RemoveAll(t => now - t > _window);

            if (clientInfo.Requests.Count >= _maxRequests)
            {
                _logger.LogWarning("Rate limit exceeded for IP: {ClientIp}", clientIp);
                context.Response.StatusCode = (int)HttpStatusCode.TooManyRequests;
                context.Response.Headers["Retry-After"] = "60";
                context.Response.ContentType = "application/json";
                var response = "{\"detail\":\"Too many requests. Please try again later.\",\"error_code\":\"RATE_LIMIT_EXCEEDED\"}";
                context.Response.WriteAsync(response);
                return;
            }

            clientInfo.Requests.Add(now);
        }

        await _next(context);
    }

    private class ClientRequestInfo
    {
        public List<DateTime> Requests { get; } = new();
    }
}

public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        context.Response.Headers["X-Frame-Options"] = "DENY";
        context.Response.Headers["X-XSS-Protection"] = "1; mode=block";
        context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        context.Response.Headers["Content-Security-Policy"] =
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            "style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; " +
            "font-src 'self' data:; connect-src 'self' ws: wss:;";

        await _next(context);
    }
}

public class CorrelationIdMiddleware
{
    private readonly RequestDelegate _next;

    public CorrelationIdMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
            ?? Guid.NewGuid().ToString("N");

        context.Items["CorrelationId"] = correlationId;
        context.Response.Headers["X-Correlation-Id"] = correlationId;

        using (Serilog.Context.LogContext.PushProperty("CorrelationId", correlationId))
        {
            await _next(context);
        }
    }
}
