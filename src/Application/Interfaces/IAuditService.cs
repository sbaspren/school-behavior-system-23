namespace SchoolBehaviorSystem.Application.Interfaces;

/// <summary>
/// سجل التدقيق المركزي — مطابق لـ logAuditAction_ في Server_Users.gs سطر 9-34
/// </summary>
public interface IAuditService
{
    Task LogAsync(string action, string details, string? userName = null, int count = 0, string? stage = null);
}
