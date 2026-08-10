using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Serilog;
using SohamYoga.Web.Data;
using SohamYoga.Web.Hubs;
using SohamYoga.Web.Middleware;
using SohamYoga.Web.Repositories.Implementations;
using SohamYoga.Web.Repositories.Interfaces;
using SohamYoga.Web.Services.Implementations;
using SohamYoga.Web.Services.Interfaces;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(new ConfigurationBuilder()
        .AddJsonFile("appsettings.json")
        .Build())
    .Enrich.FromLogContext()
    .CreateLogger();

try
{
    Log.Information("Starting Soham Yoga Web API");

    var builder = WebApplication.CreateBuilder(args);
    builder.Host.UseSerilog();

    // ─── Database ───────────────────────────────────────────────
    builder.Services.AddDbContext<ApplicationDbContext>(options =>
        options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

    // ─── Identity ───────────────────────────────────────────────
    builder.Services.AddIdentity<IdentityUser, IdentityRole>(options =>
    {
        options.Password.RequireDigit = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireNonAlphanumeric = true;
        options.Password.RequiredLength = 8;
        options.User.RequireUniqueEmail = true;
        options.SignIn.RequireConfirmedAccount = false;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(30);
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.AllowedForNewUsers = true;
    })
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

    // ─── Cookie Authentication ──────────────────────────────────
    builder.Services.ConfigureApplicationCookie(options =>
    {
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = 401;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = 403;
            return Task.CompletedTask;
        };
    });

    // ─── Repositories ───────────────────────────────────────────
    builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();

    // ─── Services ───────────────────────────────────────────────
    builder.Services.AddScoped<IBlogService, BlogService>();
    builder.Services.AddScoped<IContactService, ContactService>();
    builder.Services.AddScoped<INewsletterService, NewsletterService>();
    builder.Services.AddScoped<IEmailService, EmailService>();
    builder.Services.AddScoped<ISiteService, SiteService>();

    // ─── Controllers ────────────────────────────────────────────
    builder.Services.AddControllers()
        .AddJsonOptions(options =>
        {
            options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
            options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
            options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        });

    // ─── CORS ───────────────────────────────────────────────────
    var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
        ?? new[] { "http://localhost:3000" };

    builder.Services.AddCors(options =>
    {
        options.AddPolicy("NextJsPolicy", policy =>
        {
            policy.WithOrigins(allowedOrigins)
                .WithHeaders("Content-Type", "Authorization", "X-Correlation-Id", "X-Requested-With")
                .WithMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .AllowCredentials();
        });
    });

    // ─── Swagger ────────────────────────────────────────────────
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
        {
            Title = "Soham Yoga API",
            Version = "v1",
            Description = "REST API for Soham Yoga - IT Management & AI Solutions"
        });
    });

    // ─── Health Checks ──────────────────────────────────────────
    builder.Services.AddHealthChecks()
        .AddDbContextCheck<ApplicationDbContext>("database");

    // ─── SignalR ────────────────────────────────────────────────
    builder.Services.AddSignalR(options =>
    {
        options.MaximumReceiveMessageSize = 64 * 1024; // 64KB max message size
        options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    });

    // ─── Background Services ──────────────────────────────────
    builder.Services.AddHostedService<SohamYoga.Web.Services.Implementations.DataCleanupService>();

    // ─── Response Compression ───────────────────────────────────
    builder.Services.AddResponseCompression(options =>
    {
        options.EnableForHttps = true;
    });

    var app = builder.Build();

    // ─── Seed Database ──────────────────────────────────────────
    using (var scope = app.Services.CreateScope())
    {
        await SeedData.InitializeAsync(scope.ServiceProvider);
    }

    // ─── Middleware Pipeline ────────────────────────────────────
    app.UseResponseCompression();

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI(c =>
        {
            c.SwaggerEndpoint("/swagger/v1/swagger.json", "Soham Yoga API v1");
            c.RoutePrefix = "swagger";
        });
    }
    else
    {
        app.UseHsts();
    }

    // Security & error handling middlewares
    app.UseMiddleware<CorrelationIdMiddleware>();
    app.UseMiddleware<GlobalExceptionMiddleware>();
    app.UseMiddleware<SecurityHeadersMiddleware>();
    app.UseMiddleware<RateLimitingMiddleware>(
        int.Parse(builder.Configuration["RateLimit:MaxRequests"] ?? "100"),
        int.Parse(builder.Configuration["RateLimit:WindowSeconds"] ?? "60"));

    app.UseHttpsRedirection();
    app.UseStaticFiles();
    app.UseRouting();

    app.UseCors("NextJsPolicy");

    app.UseAuthentication();
    app.UseAuthorization();

    // API request tracking (after auth so we can capture UserId)
    app.UseMiddleware<ApiRequestTrackingMiddleware>();

    app.UseSerilogRequestLogging(options =>
    {
        options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
        {
            diagnosticContext.Set("CorrelationId",
                httpContext.Items["CorrelationId"]?.ToString() ?? "N/A");
            diagnosticContext.Set("ClientIp",
                httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown");
        };
    });

    app.MapControllers();
    app.MapHub<ChatHub>("/hubs/chat");

    // Enhanced health check endpoint with detailed DB status
    app.MapHealthChecks("/api/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
    {
        ResponseWriter = async (context, report) =>
        {
            context.Response.ContentType = "application/json";
            var response = new
            {
                status = report.Status.ToString(),
                timestamp = DateTime.UtcNow,
                version = "1.0.0",
                checks = report.Entries.Select(e => new
                {
                    name = e.Key,
                    status = e.Value.Status.ToString(),
                    duration = e.Value.Duration.TotalMilliseconds,
                    description = e.Value.Description,
                    exception = e.Value.Exception?.Message
                })
            };
            await context.Response.WriteAsJsonAsync(response);
        }
    });

    Log.Information("Soham Yoga Web API started successfully");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
