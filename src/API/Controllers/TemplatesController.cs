using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SchoolBehaviorSystem.Application.DTOs.Responses;
using SchoolBehaviorSystem.Domain.Entities;
using SchoolBehaviorSystem.Infrastructure.Data;

namespace SchoolBehaviorSystem.API.Controllers;

/// <summary>
/// إدارة قوالب الرسائل — مطابق لـ Server_Templates.gs سطر 1-68
/// </summary>
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class TemplatesController : ControllerBase
{
    private readonly AppDbContext _db;

    public TemplatesController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// جلب جميع القوالب — مطابق لـ getAllMessageTemplates() سطر 52-67
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> GetAll()
    {
        var templates = await _db.MessageTemplates.ToListAsync();
        var dict = templates.ToDictionary(t => t.Type, t => t.Content);
        return Ok(ApiResponse<object>.Ok(new { templates = dict }));
    }

    /// <summary>
    /// جلب قالب بالنوع — مطابق لـ getMessageTemplate(type) سطر 25-33
    /// </summary>
    [HttpGet("{type}")]
    public async Task<ActionResult<ApiResponse<object>>> GetByType(string type)
    {
        var template = await _db.MessageTemplates.FirstOrDefaultAsync(t => t.Type == type);
        return Ok(ApiResponse<object>.Ok(new { template = template?.Content ?? "" }));
    }

    /// <summary>
    /// حفظ/تحديث قالب — مطابق لـ saveMessageTemplate(type, message) سطر 10-18
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<object>>> Save([FromBody] TemplateSaveRequest request)
    {
        if (string.IsNullOrEmpty(request.Type))
            return BadRequest(ApiResponse<object>.Fail("نوع القالب مطلوب"));

        var existing = await _db.MessageTemplates.FirstOrDefaultAsync(t => t.Type == request.Type);
        if (existing != null)
        {
            existing.Content = request.Message ?? "";
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            _db.MessageTemplates.Add(new MessageTemplate
            {
                Type = request.Type,
                Content = request.Message ?? "",
                UpdatedAt = DateTime.UtcNow
            });
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { }, "تم الحفظ"));
    }

    /// <summary>
    /// حذف قالب (استعادة الافتراضي) — مطابق لـ deleteMessageTemplate(type) سطر 39-47
    /// </summary>
    [HttpDelete("{type}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(string type)
    {
        var existing = await _db.MessageTemplates.FirstOrDefaultAsync(t => t.Type == type);
        if (existing != null)
        {
            _db.MessageTemplates.Remove(existing);
            await _db.SaveChangesAsync();
        }
        return Ok(ApiResponse<object>.Ok(new { }));
    }
}

// ===== Request DTOs =====

public class TemplateSaveRequest
{
    public string? Type { get; set; }
    public string? Message { get; set; }
}
