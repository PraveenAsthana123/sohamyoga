using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Data;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Repositories.Implementations;

public class BlogRepository : Repository<BlogPost>, IBlogRepository
{
    public BlogRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<BlogPost?> GetBySlugAsync(string slug)
    {
        return await _dbSet
            .Include(bp => bp.Category)
            .FirstOrDefaultAsync(bp => bp.Slug == slug);
    }

    public async Task<(IEnumerable<BlogPost> Posts, int Total)> GetPublishedAsync(
        int page,
        int pageSize,
        int? categoryId = null,
        string? tag = null,
        string? search = null)
    {
        var query = _dbSet
            .Include(bp => bp.Category)
            .Where(bp => bp.IsPublished)
            .AsQueryable();

        if (categoryId.HasValue)
        {
            query = query.Where(bp => bp.CategoryId == categoryId.Value);
        }

        if (!string.IsNullOrWhiteSpace(tag))
        {
            query = query.Where(bp => bp.Tags != null && bp.Tags.Contains(tag));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(bp =>
                bp.Title.ToLower().Contains(searchLower) ||
                bp.Summary.ToLower().Contains(searchLower) ||
                bp.Content.ToLower().Contains(searchLower));
        }

        var total = await query.CountAsync();

        var posts = await query
            .OrderByDescending(bp => bp.PublishedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (posts, total);
    }

    public async Task<IEnumerable<BlogPost>> GetRecentAsync(int count = 5)
    {
        return await _dbSet
            .Include(bp => bp.Category)
            .Where(bp => bp.IsPublished)
            .OrderByDescending(bp => bp.PublishedAt)
            .Take(count)
            .ToListAsync();
    }

    public async Task<IEnumerable<BlogCategory>> GetCategoriesAsync()
    {
        return await _context.BlogCategories
            .OrderBy(c => c.Name)
            .ToListAsync();
    }

    public async Task<BlogCategory?> GetCategoryBySlugAsync(string slug)
    {
        return await _context.BlogCategories
            .FirstOrDefaultAsync(c => c.Slug == slug);
    }

    public async Task<BlogCategory?> GetCategoryByIdAsync(int id)
    {
        return await _context.BlogCategories
            .FirstOrDefaultAsync(c => c.Id == id);
    }

    public async Task AddCategoryAsync(BlogCategory category)
    {
        await _context.BlogCategories.AddAsync(category);
    }

    public void UpdateCategory(BlogCategory category)
    {
        _context.BlogCategories.Update(category);
    }

    public void RemoveCategory(BlogCategory category)
    {
        _context.BlogCategories.Remove(category);
    }

    public async Task<int> GetPostCountByCategoryAsync(int categoryId)
    {
        return await _dbSet.CountAsync(bp => bp.CategoryId == categoryId);
    }

    public async Task IncrementViewCountAsync(int id)
    {
        var post = await _dbSet.FindAsync(id);
        if (post != null)
        {
            post.ViewCount++;
        }
    }
}
