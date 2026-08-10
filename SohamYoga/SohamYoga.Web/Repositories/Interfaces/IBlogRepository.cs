using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Repositories.Interfaces;

public interface IBlogRepository : IRepository<BlogPost>
{
    Task<BlogPost?> GetBySlugAsync(string slug);
    Task<(IEnumerable<BlogPost> Posts, int Total)> GetPublishedAsync(int page, int pageSize, int? categoryId = null, string? tag = null, string? search = null);
    Task<IEnumerable<BlogPost>> GetRecentAsync(int count = 5);
    Task<IEnumerable<BlogCategory>> GetCategoriesAsync();
    Task<BlogCategory?> GetCategoryBySlugAsync(string slug);
    Task<BlogCategory?> GetCategoryByIdAsync(int id);
    Task AddCategoryAsync(BlogCategory category);
    void UpdateCategory(BlogCategory category);
    void RemoveCategory(BlogCategory category);
    Task<int> GetPostCountByCategoryAsync(int categoryId);
    Task IncrementViewCountAsync(int id);
}
