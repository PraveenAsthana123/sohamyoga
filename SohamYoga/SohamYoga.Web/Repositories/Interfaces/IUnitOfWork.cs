namespace SohamYoga.Web.Repositories.Interfaces;

public interface IUnitOfWork : IDisposable
{
    IServiceRepository Services { get; }
    IBlogRepository Blog { get; }
    ITestimonialRepository Testimonials { get; }
    ICaseStudyRepository CaseStudies { get; }
    IContactRepository Contacts { get; }
    INewsletterRepository Newsletter { get; }
    IVideoDemoRepository VideoDemos { get; }
    IIndustrySolutionRepository IndustrySolutions { get; }
    ITeamMemberRepository TeamMembers { get; }
    ISiteSettingsRepository SiteSettings { get; }
    IChatRequestRepository ChatRequests { get; }
    IAuditLogRepository AuditLogs { get; }
    IChatMessageRepository ChatMessages { get; }
    IYogaProductRepository YogaProducts { get; }
    Task<int> SaveChangesAsync();
}
