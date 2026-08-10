using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Services.Interfaces;

public interface IBlogService
{
    Task<(IEnumerable<BlogPost> Posts, int Total)> GetPublishedPostsAsync(
        int page = 1,
        int pageSize = 9,
        int? categoryId = null,
        string? tag = null,
        string? search = null);
    Task<BlogPost?> GetPostBySlugAsync(string slug);
    Task<IEnumerable<BlogPost>> GetRecentPostsAsync(int count = 5);
    Task<IEnumerable<BlogCategory>> GetCategoriesAsync();
    Task<BlogCategory?> GetCategoryBySlugAsync(string slug);
    Task<BlogPost> CreatePostAsync(BlogPost post);
    Task<BlogPost> UpdatePostAsync(BlogPost post);
    Task DeletePostAsync(int id);
    Task<BlogCategory> CreateCategoryAsync(string name, string slug, string? description);
    Task<BlogCategory> UpdateCategoryAsync(int id, string name, string slug, string? description);
    Task DeleteCategoryAsync(int id);
}
