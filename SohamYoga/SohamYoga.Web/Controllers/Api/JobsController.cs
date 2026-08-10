using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Data;
using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Controllers.Api;

[ApiController]
[Route("api/jobs")]
[Produces("application/json")]
public class JobsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<JobsController> _logger;

    public JobsController(ApplicationDbContext db, ILogger<JobsController> logger)
    {
        _db = db;
        _logger = logger;
    }

    // ── Public endpoints ─────────────────────────────────────────────────────

    /// <summary>GET /api/jobs — active job listings for public careers page</summary>
    [HttpGet]
    public async Task<IActionResult> GetActive([FromQuery] string? department = null)
    {
        var query = _db.JobPostings.Where(j => j.IsActive);
        if (!string.IsNullOrWhiteSpace(department))
            query = query.Where(j => j.Department == department);

        var jobs = await query
            .OrderBy(j => j.SortOrder)
            .ThenByDescending(j => j.CreatedAt)
            .Select(j => new
            {
                j.Id, j.Title, j.Slug, j.Department, j.Location,
                j.EmploymentType, j.SalaryRange, j.Summary, j.CreatedAt
            })
            .ToListAsync();

        return Ok(jobs);
    }

    /// <summary>GET /api/jobs/departments — distinct departments for filter</summary>
    [HttpGet("departments")]
    public async Task<IActionResult> GetDepartments()
    {
        var depts = await _db.JobPostings
            .Where(j => j.IsActive)
            .Select(j => j.Department)
            .Distinct()
            .OrderBy(d => d)
            .ToListAsync();
        return Ok(depts);
    }

    /// <summary>GET /api/jobs/slug/{slug} — full job detail (public)</summary>
    [HttpGet("slug/{slug}")]
    public async Task<IActionResult> GetBySlug(string slug)
    {
        var job = await _db.JobPostings.FirstOrDefaultAsync(j => j.Slug == slug && j.IsActive);
        if (job == null)
            return NotFound(new { detail = "Job not found.", error_code = "NOT_FOUND" });
        return Ok(job);
    }

    /// <summary>POST /api/jobs/{id}/apply — submit a job application (public)</summary>
    [HttpPost("{id}/apply")]
    public async Task<IActionResult> Apply(int id, [FromBody] JobApplication application)
    {
        var job = await _db.JobPostings.FindAsync(id);
        if (job == null || !job.IsActive)
            return NotFound(new { detail = "Job not found.", error_code = "NOT_FOUND" });

        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        application.JobPostingId = id;
        application.Status = "New";

        _db.JobApplications.Add(application);
        job.ApplicationCount++;
        await _db.SaveChangesAsync();

        _logger.LogInformation("New application for job {JobId} from {Email}", id, application.Email);
        return Ok(new { detail = "Application submitted successfully." });
    }

    // ── Admin endpoints ───────────────────────────────────────────────────────

    /// <summary>GET /api/jobs/admin/all — all jobs including inactive (admin)</summary>
    [HttpGet("admin/all")]
    [Authorize(Roles = "Admin,HR")]
    public async Task<IActionResult> GetAll()
    {
        var jobs = await _db.JobPostings
            .OrderBy(j => j.SortOrder)
            .ThenByDescending(j => j.CreatedAt)
            .ToListAsync();
        return Ok(jobs);
    }

    /// <summary>GET /api/jobs/admin/{id} — single job for editor (admin)</summary>
    [HttpGet("admin/{id}")]
    [Authorize(Roles = "Admin,HR")]
    public async Task<IActionResult> GetById(int id)
    {
        var job = await _db.JobPostings.FindAsync(id);
        if (job == null)
            return NotFound(new { detail = "Job not found.", error_code = "NOT_FOUND" });
        return Ok(job);
    }

    /// <summary>POST /api/jobs — create a new job posting (admin)</summary>
    [HttpPost]
    [Authorize(Roles = "Admin,HR")]
    public async Task<IActionResult> Create([FromBody] JobPosting job)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (string.IsNullOrWhiteSpace(job.Slug))
            job.Slug = GenerateSlug(job.Title);

        _db.JobPostings.Add(job);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Job posting created: {Title}", job.Title);
        return CreatedAtAction(nameof(GetById), new { id = job.Id }, job);
    }

    /// <summary>PUT /api/jobs/{id} — update a job posting (admin)</summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin,HR")]
    public async Task<IActionResult> Update(int id, [FromBody] JobPosting updated)
    {
        var job = await _db.JobPostings.FindAsync(id);
        if (job == null)
            return NotFound(new { detail = "Job not found.", error_code = "NOT_FOUND" });

        job.Title = updated.Title;
        job.Slug = updated.Slug;
        job.Department = updated.Department;
        job.Location = updated.Location;
        job.EmploymentType = updated.EmploymentType;
        job.SalaryRange = updated.SalaryRange;
        job.Description = updated.Description;
        job.Requirements = updated.Requirements;
        job.NiceToHave = updated.NiceToHave;
        job.Summary = updated.Summary;
        job.IsActive = updated.IsActive;
        job.SortOrder = updated.SortOrder;

        await _db.SaveChangesAsync();
        return Ok(job);
    }

    /// <summary>DELETE /api/jobs/{id} — delete a job posting (admin)</summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var job = await _db.JobPostings.FindAsync(id);
        if (job == null)
            return NotFound(new { detail = "Job not found.", error_code = "NOT_FOUND" });

        _db.JobPostings.Remove(job);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>GET /api/jobs/admin/applications — all applications (admin)</summary>
    [HttpGet("admin/applications")]
    [Authorize(Roles = "Admin,HR")]
    public async Task<IActionResult> GetApplications(
        [FromQuery] int? jobId = null,
        [FromQuery] string? status = null)
    {
        var query = _db.JobApplications.Include(a => a.JobPosting).AsQueryable();

        if (jobId.HasValue) query = query.Where(a => a.JobPostingId == jobId.Value);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(a => a.Status == status);

        var apps = await query
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new
            {
                a.Id, a.Name, a.Email, a.Phone, a.LinkedInUrl, a.PortfolioUrl,
                a.CoverLetter, a.Status, a.AdminNotes, a.CreatedAt,
                JobTitle = a.JobPosting != null ? a.JobPosting.Title : "Unknown"
            })
            .ToListAsync();

        return Ok(apps);
    }

    /// <summary>PUT /api/jobs/admin/applications/{id}/status — update application status</summary>
    [HttpPut("admin/applications/{id}/status")]
    [Authorize(Roles = "Admin,HR")]
    public async Task<IActionResult> UpdateApplicationStatus(int id, [FromBody] UpdateStatusRequest req)
    {
        var app = await _db.JobApplications.FindAsync(id);
        if (app == null)
            return NotFound(new { detail = "Application not found.", error_code = "NOT_FOUND" });

        app.Status = req.Status;
        app.AdminNotes = req.AdminNotes;
        await _db.SaveChangesAsync();
        return Ok(new { detail = "Status updated." });
    }

    private static string GenerateSlug(string title)
    {
        return title.ToLowerInvariant()
            .Replace(" ", "-")
            .Replace("--", "-")
            .Trim('-');
    }
}

public record UpdateStatusRequest(string Status, string? AdminNotes);
