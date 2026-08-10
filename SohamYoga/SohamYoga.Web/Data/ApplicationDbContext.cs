using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Data;

public class ApplicationDbContext : IdentityDbContext<IdentityUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Service> Services => Set<Service>();
    public DbSet<Testimonial> Testimonials => Set<Testimonial>();
    public DbSet<CaseStudy> CaseStudies => Set<CaseStudy>();
    public DbSet<BlogPost> BlogPosts => Set<BlogPost>();
    public DbSet<BlogCategory> BlogCategories => Set<BlogCategory>();
    public DbSet<TeamMember> TeamMembers => Set<TeamMember>();
    public DbSet<ContactMessage> ContactMessages => Set<ContactMessage>();
    public DbSet<NewsletterSubscriber> NewsletterSubscribers => Set<NewsletterSubscriber>();
    public DbSet<VideoDemo> VideoDemos => Set<VideoDemo>();
    public DbSet<IndustrySolution> IndustrySolutions => Set<IndustrySolution>();
    public DbSet<SiteSettings> SiteSettings => Set<SiteSettings>();
    public DbSet<ChatRequest> ChatRequests => Set<ChatRequest>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<ApiRequestLog> ApiRequestLogs => Set<ApiRequestLog>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();
    public DbSet<JobPosting> JobPostings => Set<JobPosting>();
    public DbSet<JobApplication> JobApplications => Set<JobApplication>();
    public DbSet<YogaProduct> YogaProducts => Set<YogaProduct>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // SQLite WAL mode for better concurrent read performance
        builder.HasAnnotation("Sqlite:WalMode", true);

        // Unique indexes
        builder.Entity<Service>()
            .HasIndex(s => s.Slug)
            .IsUnique();

        builder.Entity<CaseStudy>()
            .HasIndex(cs => cs.Slug)
            .IsUnique();

        builder.Entity<BlogPost>()
            .HasIndex(bp => bp.Slug)
            .IsUnique();

        builder.Entity<BlogCategory>()
            .HasIndex(bc => bc.Slug)
            .IsUnique();

        builder.Entity<IndustrySolution>()
            .HasIndex(ins => ins.Slug)
            .IsUnique();

        builder.Entity<NewsletterSubscriber>()
            .HasIndex(ns => ns.Email)
            .IsUnique();

        builder.Entity<NewsletterSubscriber>()
            .HasIndex(ns => ns.Token)
            .IsUnique();

        // BlogPost -> BlogCategory relationship (one-to-many)
        builder.Entity<BlogPost>()
            .HasOne(bp => bp.Category)
            .WithMany(bc => bc.Posts)
            .HasForeignKey(bp => bp.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        // AuditLog indexes for query performance
        builder.Entity<AuditLog>()
            .HasIndex(a => a.CreatedAt);
        builder.Entity<AuditLog>()
            .HasIndex(a => a.Action);
        builder.Entity<AuditLog>()
            .HasIndex(a => a.EntityType);

        // ApiRequestLog indexes for query performance
        builder.Entity<ApiRequestLog>()
            .HasIndex(a => a.CreatedAt);
        builder.Entity<ApiRequestLog>()
            .HasIndex(a => a.Path);
        builder.Entity<ApiRequestLog>()
            .HasIndex(a => a.StatusCode);

        // ChatMessage indexes
        builder.Entity<ChatMessage>()
            .HasIndex(m => m.SessionId);
        builder.Entity<ChatMessage>()
            .HasIndex(m => m.CreatedAt);
        builder.Entity<ChatMessage>()
            .HasIndex(m => m.CustomerId);

        // JobPosting indexes
        builder.Entity<JobPosting>()
            .HasIndex(j => j.Slug).IsUnique();
        builder.Entity<JobPosting>()
            .HasIndex(j => j.IsActive);
        builder.Entity<JobPosting>()
            .HasIndex(j => j.Department);

        // JobApplication relationship
        builder.Entity<JobApplication>()
            .HasOne(a => a.JobPosting)
            .WithMany()
            .HasForeignKey(a => a.JobPostingId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Entity<JobApplication>()
            .HasIndex(a => a.JobPostingId);
        builder.Entity<JobApplication>()
            .HasIndex(a => a.Status);

        // YogaProduct indexes
        builder.Entity<YogaProduct>()
            .HasIndex(yp => yp.Slug)
            .IsUnique();
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = now;
                    entry.Entity.UpdatedAt = now;
                    break;

                case EntityState.Modified:
                    entry.Entity.UpdatedAt = now;
                    break;
            }
        }

        return await base.SaveChangesAsync(cancellationToken);
    }
}
