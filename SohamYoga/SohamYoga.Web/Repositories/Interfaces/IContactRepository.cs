using SohamYoga.Web.Models.Entities;

namespace SohamYoga.Web.Repositories.Interfaces;

public interface IContactRepository : IRepository<ContactMessage>
{
    Task<int> GetUnreadCountAsync();
    Task MarkAsReadAsync(int id);
}
