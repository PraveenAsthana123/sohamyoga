using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Services.Interfaces;

public interface ISiteService
{
    Task<SiteSettings?> GetSettingsAsync();
    Task UpdateSettingsAsync(SiteSettings settings);
    Task<HomePageData> GetHomePageDataAsync();
}

public class HomePageData
{
    public IEnumerable<Service> FeaturedServices { get; set; } = new List<Service>();
    public IEnumerable<Service> AllServices { get; set; } = new List<Service>();
    public IEnumerable<Testimonial> Testimonials { get; set; } = new List<Testimonial>();
    public IEnumerable<CaseStudy> CaseStudies { get; set; } = new List<CaseStudy>();
    public IEnumerable<IndustrySolution> Industries { get; set; } = new List<IndustrySolution>();
    public IEnumerable<VideoDemo> VideoDemos { get; set; } = new List<VideoDemo>();
    public IEnumerable<BlogPost> RecentPosts { get; set; } = new List<BlogPost>();
    public IEnumerable<TeamMember> TeamMembers { get; set; } = new List<TeamMember>();
    public SiteSettings? Settings { get; set; }
}
