using System.Text.RegularExpressions;
using SohamYoga.Web.Exceptions;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;
using SohamYoga.Web.Services.Interfaces;

namespace SohamYoga.Web.Services.Implementations;

public class BlogService : IBlogService
{
    private readonly IUnitOfWork _unitOfWork;

    public BlogService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<(IEnumerable<BlogPost> Posts, int Total)> GetPublishedPostsAsync(
        int page = 1,
        int pageSize = 9,
        int? categoryId = null,
        string? tag = null,
        string? search = null)
    {
        return await _unitOfWork.Blog.GetPublishedAsync(page, pageSize, categoryId, tag, search);
    }

    public async Task<BlogPost?> GetPostBySlugAsync(string slug)
    {
        var post = await _unitOfWork.Blog.GetBySlugAsync(slug);
        if (post == null)
        {
            return null;
        }

        await _unitOfWork.Blog.IncrementViewCountAsync(post.Id);
        await _unitOfWork.SaveChangesAsync();

        return post;
    }

    public async Task<IEnumerable<BlogPost>> GetRecentPostsAsync(int count = 5)
    {
        return await _unitOfWork.Blog.GetRecentAsync(count);
    }

    public async Task<IEnumerable<BlogCategory>> GetCategoriesAsync()
    {
        return await _unitOfWork.Blog.GetCategoriesAsync();
    }

    public async Task<BlogCategory?> GetCategoryBySlugAsync(string slug)
    {
        return await _unitOfWork.Blog.GetCategoryBySlugAsync(slug);
    }

    public async Task<BlogPost> CreatePostAsync(BlogPost post)
    {
        if (string.IsNullOrWhiteSpace(post.Slug))
        {
            post.Slug = GenerateSlug(post.Title);
        }

        post.CreatedAt = DateTime.UtcNow;
        post.UpdatedAt = DateTime.UtcNow;

        if (post.IsPublished && !post.PublishedAt.HasValue)
        {
            post.PublishedAt = DateTime.UtcNow;
        }

        await _unitOfWork.Blog.AddAsync(post);
        await _unitOfWork.SaveChangesAsync();

        return post;
    }

    public async Task<BlogPost> UpdatePostAsync(BlogPost post)
    {
        post.UpdatedAt = DateTime.UtcNow;

        if (post.IsPublished && !post.PublishedAt.HasValue)
        {
            post.PublishedAt = DateTime.UtcNow;
        }

        _unitOfWork.Blog.Update(post);
        await _unitOfWork.SaveChangesAsync();

        return post;
    }

    public async Task DeletePostAsync(int id)
    {
        var post = await _unitOfWork.Blog.GetByIdAsync(id);
        if (post == null)
        {
            throw new KeyNotFoundException($"Blog post with ID {id} was not found.");
        }

        _unitOfWork.Blog.Remove(post);
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task<BlogCategory> CreateCategoryAsync(string name, string slug, string? description)
    {
        var existing = await _unitOfWork.Blog.GetCategoryBySlugAsync(slug);
        if (existing != null)
        {
            throw new ConflictException($"A category with slug '{slug}' already exists.");
        }

        var category = new BlogCategory
        {
            Name = name,
            Slug = slug,
            Description = description,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.Blog.AddCategoryAsync(category);
        await _unitOfWork.SaveChangesAsync();

        return category;
    }

    public async Task<BlogCategory> UpdateCategoryAsync(int id, string name, string slug, string? description)
    {
        var category = await _unitOfWork.Blog.GetCategoryByIdAsync(id);
        if (category == null)
        {
            throw new NotFoundException($"Blog category with ID {id} was not found.");
        }

        var existing = await _unitOfWork.Blog.GetCategoryBySlugAsync(slug);
        if (existing != null && existing.Id != id)
        {
            throw new ConflictException($"A category with slug '{slug}' already exists.");
        }

        category.Name = name;
        category.Slug = slug;
        category.Description = description;
        category.UpdatedAt = DateTime.UtcNow;

        _unitOfWork.Blog.UpdateCategory(category);
        await _unitOfWork.SaveChangesAsync();

        return category;
    }

    public async Task DeleteCategoryAsync(int id)
    {
        var category = await _unitOfWork.Blog.GetCategoryByIdAsync(id);
        if (category == null)
        {
            throw new NotFoundException($"Blog category with ID {id} was not found.");
        }

        var postCount = await _unitOfWork.Blog.GetPostCountByCategoryAsync(id);
        if (postCount > 0)
        {
            throw new ValidationException(
                $"Cannot delete category '{category.Name}' because it has {postCount} associated blog post(s). Reassign or delete the posts first.");
        }

        _unitOfWork.Blog.RemoveCategory(category);
        await _unitOfWork.SaveChangesAsync();
    }

    /// <summary>
    /// Generates a URL-friendly slug from a title string.
    /// Converts to lowercase, replaces spaces and non-alphanumeric characters with hyphens,
    /// collapses multiple hyphens, and trims leading/trailing hyphens.
    /// </summary>
    /// <param name="title">The title to convert into a slug.</param>
    /// <returns>A URL-friendly slug string.</returns>
    public static string GenerateSlug(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return string.Empty;
        }

        // Convert to lowercase
        var slug = title.ToLowerInvariant();

        // Remove accented characters by replacing common ones
        slug = slug.Replace("ä", "ae")
                   .Replace("ö", "oe")
                   .Replace("ü", "ue")
                   .Replace("ß", "ss");

        // Remove any characters that are not alphanumeric, spaces, or hyphens
        slug = Regex.Replace(slug, @"[^a-z0-9\s-]", "");

        // Replace spaces and multiple hyphens with a single hyphen
        slug = Regex.Replace(slug, @"[\s-]+", "-");

        // Trim hyphens from start and end
        slug = slug.Trim('-');

        return slug;
    }
}
