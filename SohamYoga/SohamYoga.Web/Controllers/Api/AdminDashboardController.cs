using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SohamYoga.Web.Repositories.Interfaces;
using SohamYoga.Web.Services.Interfaces;

namespace SohamYoga.Web.Controllers.Api;

[ApiController]
[Route("api/admin/dashboard")]
[Authorize(Roles = "Admin")]
[Produces("application/json")]
public class AdminDashboardController : ControllerBase
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IContactService _contactService;
    private readonly INewsletterService _newsletterService;
    private readonly ILogger<AdminDashboardController> _logger;

    public AdminDashboardController(
        IUnitOfWork unitOfWork,
        IContactService contactService,
        INewsletterService newsletterService,
        ILogger<AdminDashboardController> logger)
    {
        _unitOfWork = unitOfWork;
        _contactService = contactService;
        _newsletterService = newsletterService;
        _logger = logger;
    }

    /// <summary>
    /// Gets the admin dashboard summary data including counts and recent items.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> GetDashboard()
    {
        try
        {
            var servicesTask = _unitOfWork.Services.GetAllAsync();
            var blogPostsTask = _unitOfWork.Blog.GetAllAsync();
            var caseStudiesTask = _unitOfWork.CaseStudies.GetAllAsync();
            var unreadCountTask = _contactService.GetUnreadCountAsync();
            var subscriberCountTask = _newsletterService.GetSubscriberCountAsync();
            var recentMessagesTask = _contactService.GetAllMessagesAsync();

            await Task.WhenAll(servicesTask, blogPostsTask, caseStudiesTask, unreadCountTask, subscriberCountTask, recentMessagesTask);

            var services = await servicesTask;
            var blogPosts = await blogPostsTask;
            var caseStudies = await caseStudiesTask;
            var unreadMessages = await unreadCountTask;
            var subscriberCount = await subscriberCountTask;
            var allMessages = await recentMessagesTask;

            var recentMessages = allMessages
                .OrderByDescending(m => m.CreatedAt)
                .Take(5)
                .ToList();

            var recentPosts = blogPosts
                .OrderByDescending(p => p.CreatedAt)
                .Take(5)
                .Select(p => new
                {
                    p.Id,
                    p.Title,
                    p.Slug,
                    p.AuthorName,
                    p.IsPublished,
                    p.PublishedAt,
                    p.CreatedAt,
                    p.ViewCount
                })
                .ToList();

            return Ok(new
            {
                totalServices = services.Count(),
                totalBlogPosts = blogPosts.Count(),
                totalCaseStudies = caseStudies.Count(),
                unreadMessages,
                subscriberCount,
                recentMessages,
                recentPosts
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving admin dashboard data");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { detail = "An error occurred while retrieving dashboard data.", error_code = "INTERNAL_ERROR" });
        }
    }
}
