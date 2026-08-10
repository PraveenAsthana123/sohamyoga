using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Data;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Repositories.Implementations;

public class SiteSettingsRepository : ISiteSettingsRepository
{
    private readonly ApplicationDbContext _context;

    public SiteSettingsRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<SiteSettings?> GetAsync()
    {
        return await _context.SiteSettings.FirstOrDefaultAsync();
    }

    public async Task UpdateAsync(SiteSettings settings)
    {
        var existing = await _context.SiteSettings.FirstOrDefaultAsync();
        if (existing == null)
        {
            await _context.SiteSettings.AddAsync(settings);
        }
        else
        {
            _context.Entry(existing).CurrentValues.SetValues(settings);
        }
    }
}
