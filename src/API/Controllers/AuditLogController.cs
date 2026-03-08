using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SchoolBehaviorSystem.Infrastructure.Data;

namespace SchoolBehaviorSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AuditLogController : ControllerBase
{
    private readonly AppDbContext _db;

    public AuditLogController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// GET /api/auditlog?page=1&pageSize=50&action=&user=&dateFrom=&dateTo=
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<object>> GetLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? action = null,
        [FromQuery] string? user = null,
        [FromQuery] string? dateFrom = null,
        [FromQuery] string? dateTo = null)
    {
        var query = _db.AuditLogs.AsQueryable();

        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(a => a.ActionType.Contains(action));
        if (!string.IsNullOrWhiteSpace(user))
            query = query.Where(a => a.UserName.Contains(user));
        if (!string.IsNullOrWhiteSpace(dateFrom))
            query = query.Where(a => string.Compare(a.Date, dateFrom) >= 0);
        if (!string.IsNullOrWhiteSpace(dateTo))
            query = query.Where(a => string.Compare(a.Date, dateTo) <= 0);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new
            {
                a.Id,
                a.Date,
                a.Time,
                a.UserName,
                a.ActionType,
                a.Details,
                a.Count,
                a.Stage
            })
            .ToListAsync();

        return Ok(new { data = new { items, total, page, pageSize } });
    }
}
