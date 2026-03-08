using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SchoolBehaviorSystem.Application.DTOs.Responses;
using SchoolBehaviorSystem.Domain.Entities;
using SchoolBehaviorSystem.Infrastructure.Data;

namespace SchoolBehaviorSystem.API.Controllers;

/// <summary>
/// CRUD المواد الدراسية — مطابق لـ addSubject + deleteSubject في Server_Settings.gs سطر 673-723
/// </summary>
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class SubjectsController : ControllerBase
{
    private readonly AppDbContext _db;

    public SubjectsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetSubjects()
    {
        var subjects = await _db.Subjects
            .OrderBy(s => s.Name)
            .Select(s => new { s.Id, s.Name, s.CreatedAt })
            .ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(subjects.Cast<object>().ToList()));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse>> AddSubject([FromBody] SubjectRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return Ok(ApiResponse.Fail("اسم المادة مطلوب"));

        var subject = new Subject
        {
            Name = request.Name.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        _db.Subjects.Add(subject);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("تم إضافة المادة بنجاح"));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse>> DeleteSubject(int id)
    {
        var subject = await _db.Subjects.FindAsync(id);
        if (subject == null)
            return Ok(ApiResponse.Fail("المادة غير موجودة"));

        _db.Subjects.Remove(subject);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("تم حذف المادة بنجاح"));
    }
}

public class SubjectRequest
{
    public string Name { get; set; } = "";
}
