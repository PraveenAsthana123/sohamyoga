using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Repositories.Interfaces;

public interface ISiteSettingsRepository
{
    Task<SiteSettings?> GetAsync();
    Task UpdateAsync(SiteSettings settings);
}
