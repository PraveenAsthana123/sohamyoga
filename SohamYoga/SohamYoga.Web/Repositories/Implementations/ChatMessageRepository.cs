using Microsoft.EntityFrameworkCore;
using SohamYoga.Web.Data;
using SohamYoga.Web.Models.Entities;
using SohamYoga.Web.Repositories.Interfaces;

namespace SohamYoga.Web.Repositories.Implementations;

public class ChatMessageRepository : Repository<ChatMessage>, IChatMessageRepository
{
    public ChatMessageRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<ChatMessage>> GetBySessionIdAsync(string sessionId)
    {
        return await _dbSet
            .Where(m => m.SessionId == sessionId)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();
    }

    public async Task<IEnumerable<string>> GetActiveSessionIdsAsync(int hours = 24)
    {
        var since = DateTime.UtcNow.AddHours(-hours);
        return await _dbSet
            .Where(m => m.CreatedAt >= since)
            .Select(m => m.SessionId)
            .Distinct()
            .ToListAsync();
    }

    public async Task<int> GetUnreadCountAsync()
    {
        return await _dbSet.CountAsync(m => !m.IsRead && !m.IsFromAdmin);
    }

    public async Task MarkSessionReadAsync(string sessionId)
    {
        var unread = await _dbSet
            .Where(m => m.SessionId == sessionId && !m.IsRead && !m.IsFromAdmin)
            .ToListAsync();

        foreach (var msg in unread)
            msg.IsRead = true;
    }
}
