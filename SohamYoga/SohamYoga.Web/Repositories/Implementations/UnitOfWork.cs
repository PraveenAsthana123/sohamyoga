using SohamYoga.Web.Data;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Repositories.Implementations;

public class UnitOfWork : IUnitOfWork
{
    private readonly ApplicationDbContext _context;

    private IServiceRepository? _services;
    private IBlogRepository? _blog;
    private ITestimonialRepository? _testimonials;
    private ICaseStudyRepository? _caseStudies;
    private IContactRepository? _contacts;
    private INewsletterRepository? _newsletter;
    private IVideoDemoRepository? _videoDemos;
    private IIndustrySolutionRepository? _industrySolutions;
    private ITeamMemberRepository? _teamMembers;
    private ISiteSettingsRepository? _siteSettings;
    private IChatRequestRepository? _chatRequests;
    private IAuditLogRepository? _auditLogs;
    private IChatMessageRepository? _chatMessages;
    private IYogaProductRepository? _yogaProducts;

    public UnitOfWork(ApplicationDbContext context)
    {
        _context = context;
    }

    public IServiceRepository Services =>
        _services ??= new ServiceRepository(_context);

    public IBlogRepository Blog =>
        _blog ??= new BlogRepository(_context);

    public ITestimonialRepository Testimonials =>
        _testimonials ??= new TestimonialRepository(_context);

    public ICaseStudyRepository CaseStudies =>
        _caseStudies ??= new CaseStudyRepository(_context);

    public IContactRepository Contacts =>
        _contacts ??= new ContactRepository(_context);

    public INewsletterRepository Newsletter =>
        _newsletter ??= new NewsletterRepository(_context);

    public IVideoDemoRepository VideoDemos =>
        _videoDemos ??= new VideoDemoRepository(_context);

    public IIndustrySolutionRepository IndustrySolutions =>
        _industrySolutions ??= new IndustrySolutionRepository(_context);

    public ITeamMemberRepository TeamMembers =>
        _teamMembers ??= new TeamMemberRepository(_context);

    public ISiteSettingsRepository SiteSettings =>
        _siteSettings ??= new SiteSettingsRepository(_context);

    public IChatRequestRepository ChatRequests =>
        _chatRequests ??= new ChatRequestRepository(_context);

    public IAuditLogRepository AuditLogs =>
        _auditLogs ??= new AuditLogRepository(_context);

    public IChatMessageRepository ChatMessages =>
        _chatMessages ??= new ChatMessageRepository(_context);

    public IYogaProductRepository YogaProducts =>
        _yogaProducts ??= new YogaProductRepository(_context);

    public async Task<int> SaveChangesAsync()
    {
        return await _context.SaveChangesAsync();
    }

    public void Dispose()
    {
        _context.Dispose();
        GC.SuppressFinalize(this);
    }
}
