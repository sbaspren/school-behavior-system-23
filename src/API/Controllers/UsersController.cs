using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SchoolBehaviorSystem.Application.DTOs.Responses;
using SchoolBehaviorSystem.Application.Interfaces;
using SchoolBehaviorSystem.Domain.Entities;
using SchoolBehaviorSystem.Domain.Enums;
using SchoolBehaviorSystem.Infrastructure.Data;

namespace SchoolBehaviorSystem.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IAuthService _authService;

    public UsersController(AppDbContext db, IAuthService authService)
    {
        _db = db;
        _authService = authService;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetUsers()
    {
        var users = await _db.Users.Select(u => new
        {
            u.Id, u.Name, role = u.Role.ToString(), u.Mobile, u.Email,
            u.Permissions, u.ScopeType, u.ScopeValue, u.IsActive,
            u.TokenLink, u.LinkUrl, u.CreatedAt, u.UpdatedAt
        }).ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(users.Cast<object>().ToList()));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse>> AddUser([FromBody] AddUserRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return Ok(ApiResponse.Fail("الاسم مطلوب"));

        if (!Enum.TryParse<UserRole>(request.Role, true, out var role))
            return Ok(ApiResponse.Fail("الدور غير صالح"));

        // كشف التكرار بالجوال
        if (!string.IsNullOrEmpty(request.Mobile))
        {
            var exists = await _db.Users.AnyAsync(u => u.Mobile == request.Mobile);
            if (exists)
                return Ok(ApiResponse.Fail("رقم الجوال مسجل مسبقاً"));
        }

        var tokenLink = _authService.GenerateTokenLink();
        var user = new User
        {
            Name = request.Name,
            Role = role,
            Mobile = request.Mobile ?? "",
            Email = request.Email ?? "",
            PasswordHash = !string.IsNullOrEmpty(request.Password)
                ? BCrypt.Net.BCrypt.HashPassword(request.Password)
                : "",
            Permissions = request.Permissions ?? "",
            ScopeType = request.ScopeType ?? "all",
            ScopeValue = request.ScopeValue ?? "",
            IsActive = true,
            TokenLink = tokenLink,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("تم إضافة المستخدم بنجاح"));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse>> UpdateUser(int id, [FromBody] AddUserRequest request)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null)
            return Ok(ApiResponse.Fail("المستخدم غير موجود"));

        if (!string.IsNullOrWhiteSpace(request.Name)) user.Name = request.Name;
        if (Enum.TryParse<UserRole>(request.Role, true, out var role)) user.Role = role;
        if (request.Mobile != null) user.Mobile = request.Mobile;
        if (request.Email != null) user.Email = request.Email;
        if (request.Permissions != null) user.Permissions = request.Permissions;
        if (request.ScopeType != null) user.ScopeType = request.ScopeType;
        if (request.ScopeValue != null) user.ScopeValue = request.ScopeValue;
        if (!string.IsNullOrEmpty(request.Password))
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("تم تحديث المستخدم بنجاح"));
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse>> DeleteUser(int id, [FromServices] IAuditService audit)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null)
            return Ok(ApiResponse.Fail("المستخدم غير موجود"));

        var deletedName = user.Name;
        _db.Users.Remove(user);
        await _db.SaveChangesAsync();

        await audit.LogAsync("حذف مستخدم", $"تم حذف: {deletedName} (ID: {id})");
        return Ok(ApiResponse.Ok("تم حذف المستخدم بنجاح"));
    }

    // ============================================================
    // Link Management
    // ============================================================

    [HttpPost("{id}/create-link")]
    public async Task<ActionResult<ApiResponse<object>>> CreateLink(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return Ok(ApiResponse.Fail("المستخدم غير موجود"));

        user.TokenLink = _authService.GenerateTokenLink();
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { tokenLink = user.TokenLink }));
    }

    [HttpPost("{id}/remove-link")]
    public async Task<ActionResult<ApiResponse>> RemoveLink(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return Ok(ApiResponse.Fail("المستخدم غير موجود"));

        user.TokenLink = "";
        user.LinkUrl = "";
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("تم إلغاء الربط"));
    }

    /// <summary>خيارات النطاق (المراحل، الصفوف، الفصول) — مطابق لـ getScopeOptions في Server_Users.gs سطر 214-253</summary>
    [HttpGet("scope-options")]
    public async Task<ActionResult<ApiResponse<object>>> GetScopeOptions()
    {
        var stages = await _db.Students.Select(s => s.Stage.ToString()).Distinct().ToListAsync();
        var grades = await _db.Students.Where(s => s.Grade != "").Select(s => s.Grade).Distinct().ToListAsync();
        var classes = await _db.Students.Where(s => s.Class != "").Select(s => s.Class).Distinct().ToListAsync();

        return Ok(ApiResponse<object>.Ok(new { stages, grades, classes }));
    }

    /// <summary>أعضاء لجنة التوجيه والسلوك — مطابق لـ getCommitteeMembers في Server_Users.gs سطر 258-279</summary>
    [HttpGet("committee-members")]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetCommitteeMembers()
    {
        var members = await _db.Users
            .Where(u => u.IsActive)
            .Select(u => new
            {
                u.Id,
                u.Name,
                role = "عضو",
                jobTitle = u.Role.ToString()
            })
            .ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(members.Cast<object>().ToList()));
    }

    /// <summary>إنشاء رابط بالبحث عن المستخدم برقم الجوال — مطابق لـ createUserLinkByPhone_ في Server_TeacherInput.gs</summary>
    [HttpPost("create-link-by-phone")]
    public async Task<ActionResult<ApiResponse<object>>> CreateLinkByPhone([FromBody] CreateLinkByPhoneRequest request)
    {
        if (string.IsNullOrEmpty(request.Phone))
            return BadRequest(ApiResponse<object>.Fail("رقم الجوال مطلوب"));

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Mobile == request.Phone);

        if (user == null)
            return Ok(ApiResponse<object>.Fail("لم يتم العثور على مستخدم بهذا الرقم"));

        user.TokenLink = _authService.GenerateTokenLink();
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            userId = user.Id,
            name = user.Name,
            role = user.Role.ToString(),
            tokenLink = user.TokenLink
        }));
    }

    [HttpPost("create-all-links")]
    public async Task<ActionResult<ApiResponse<object>>> CreateAllLinks()
    {
        var users = await _db.Users.Where(u => u.IsActive).ToListAsync();
        int created = 0;
        foreach (var u in users)
        {
            if (string.IsNullOrEmpty(u.TokenLink))
            {
                u.TokenLink = _authService.GenerateTokenLink();
                u.UpdatedAt = DateTime.UtcNow;
                created++;
            }
        }
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { created, total = users.Count }));
    }
}

public class AddUserRequest
{
    public string Name { get; set; } = "";
    public string? Role { get; set; }
    public string? Mobile { get; set; }
    public string? Email { get; set; }
    public string? Password { get; set; }
    public string? Permissions { get; set; }
    public string? ScopeType { get; set; }
    public string? ScopeValue { get; set; }
}
