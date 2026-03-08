using SchoolBehaviorSystem.Application.Interfaces;
using SchoolBehaviorSystem.Domain.Entities;
using SchoolBehaviorSystem.Infrastructure.Data;

namespace SchoolBehaviorSystem.Infrastructure.Services;

/// <summary>
/// تسجيل التدقيق — مطابق لـ logAuditAction_ في Server_Users.gs سطر 9-34
/// </summary>
public class AuditService : IAuditService
{
    private readonly AppDbContext _db;

    public AuditService(AppDbContext db)
    {
        _db = db;
    }

    public async Task LogAsync(string action, string details, string? userName = null, int count = 0, string? stage = null)
    {
        try
        {
            var now = DateTime.Now;
            _db.AuditLogs.Add(new AuditLog
            {
                Date = now.ToString("yyyy/MM/dd"),
                Time = now.ToString("HH:mm:ss"),
                UserName = userName ?? "نظام",
                ActionType = action,
                Details = details,
                Count = count,
                Stage = stage ?? "",
                CreatedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();
        }
        catch
        {
            // مطابق للأصلي: لا تكسر العملية إذا فشل التسجيل
        }
    }
}
