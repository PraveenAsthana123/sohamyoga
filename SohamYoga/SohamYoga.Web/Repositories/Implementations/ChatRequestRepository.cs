using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Data;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Repositories.Implementations;

public class ChatRequestRepository : Repository<ChatRequest>, IChatRequestRepository
{
    public ChatRequestRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<ChatRequest>> GetUnresolvedAsync()
    {
        return await _dbSet
            .Where(cr => !cr.IsResolved)
            .OrderByDescending(cr => cr.CreatedAt)
            .ToListAsync();
    }

    public async Task<int> GetUnresolvedCountAsync()
    {
        return await _dbSet.CountAsync(cr => !cr.IsResolved);
    }

    public async Task<IEnumerable<ChatRequest>> GetByAssigneeAsync(string assignedTo)
    {
        return await _dbSet
            .Where(cr => cr.AssignedTo == assignedTo)
            .OrderByDescending(cr => cr.CreatedAt)
            .ToListAsync();
    }
}
