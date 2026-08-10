using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Data;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Repositories.Implementations;

public class ContactRepository : Repository<ContactMessage>, IContactRepository
{
    public ContactRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<int> GetUnreadCountAsync()
    {
        return await _dbSet.CountAsync(cm => !cm.IsRead && !cm.IsArchived);
    }

    public async Task MarkAsReadAsync(int id)
    {
        var message = await _dbSet.FindAsync(id);
        if (message != null)
        {
            message.IsRead = true;
        }
    }
}
