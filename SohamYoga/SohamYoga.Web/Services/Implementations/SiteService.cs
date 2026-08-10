using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;
using SohamYoga.Web.Services.Interfaces;

namespace SohamYoga.Web.Services.Implementations;

public class SiteService : ISiteService
{
    private readonly IUnitOfWork _unitOfWork;

    public SiteService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<SiteSettings?> GetSettingsAsync()
    {
        return await _unitOfWork.SiteSettings.GetAsync();
    }

    public async Task UpdateSettingsAsync(SiteSettings settings)
    {
        await _unitOfWork.SiteSettings.UpdateAsync(settings);
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task<HomePageData> GetHomePageDataAsync()
    {
        // Fetch all data in parallel for optimal performance
        var featuredServicesTask = _unitOfWork.Services.GetFeaturedAsync();
        var allServicesTask = _unitOfWork.Services.GetActiveOrderedAsync();
        var testimonialsTask = _unitOfWork.Testimonials.GetActiveOrderedAsync();
        var caseStudiesTask = _unitOfWork.CaseStudies.GetActiveOrderedAsync();
        var industriesTask = _unitOfWork.IndustrySolutions.GetActiveOrderedAsync();
        var videoDemosTask = _unitOfWork.VideoDemos.GetActiveOrderedAsync();
        var recentPostsTask = _unitOfWork.Blog.GetRecentAsync(3);
        var teamMembersTask = _unitOfWork.TeamMembers.GetActiveOrderedAsync();
        var settingsTask = _unitOfWork.SiteSettings.GetAsync();

        await Task.WhenAll(
            featuredServicesTask,
            allServicesTask,
            testimonialsTask,
            caseStudiesTask,
            industriesTask,
            videoDemosTask,
            recentPostsTask,
            teamMembersTask,
            settingsTask);

        return new HomePageData
        {
            FeaturedServices = await featuredServicesTask,
            AllServices = await allServicesTask,
            Testimonials = await testimonialsTask,
            CaseStudies = await caseStudiesTask,
            Industries = await industriesTask,
            VideoDemos = await videoDemosTask,
            RecentPosts = await recentPostsTask,
            TeamMembers = await teamMembersTask,
            Settings = await settingsTask
        };
    }
}
