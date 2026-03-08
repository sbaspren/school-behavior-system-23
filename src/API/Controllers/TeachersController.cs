using Microsoft.AspNetCore.Authorization;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SchoolBehaviorSystem.Application.DTOs.Responses;
using SchoolBehaviorSystem.Application.Interfaces;
using SchoolBehaviorSystem.Infrastructure.Data;
using SchoolBehaviorSystem.Domain.Entities;

namespace SchoolBehaviorSystem.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class TeachersController : ControllerBase
{
    private readonly AppDbContext _db;

    public TeachersController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetTeachers()
    {
        var teachers = await _db.Teachers.Select(t => new
        {
            t.Id, t.CivilId, t.Name, t.Mobile,
            subjects = t.Subjects,
            assignedClasses = t.AssignedClasses,
            t.IsActive, t.TokenLink, t.LinkUrl, t.CreatedAt
        }).ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(teachers.Cast<object>().ToList()));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse>> AddTeacher([FromBody] TeacherRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CivilId))
            return Ok(ApiResponse.Fail("السجل المدني مطلوب"));
        if (string.IsNullOrWhiteSpace(request.Name))
            return Ok(ApiResponse.Fail("الاسم مطلوب"));

        // كشف التكرار بالسجل المدني
        var exists = await _db.Teachers.AnyAsync(t => t.CivilId == request.CivilId);
        if (exists)
            return Ok(ApiResponse.Fail("السجل المدني مسجل مسبقاً"));

        var teacher = new Teacher
        {
            CivilId = request.CivilId,
            Name = request.Name,
            Mobile = request.Mobile ?? "",
            Subjects = request.Subjects ?? "",
            AssignedClasses = request.AssignedClasses ?? "",
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Teachers.Add(teacher);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("تم إضافة المعلم بنجاح"));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse>> UpdateTeacher(int id, [FromBody] TeacherRequest request)
    {
        var teacher = await _db.Teachers.FindAsync(id);
        if (teacher == null)
            return Ok(ApiResponse.Fail("المعلم غير موجود"));

        if (!string.IsNullOrWhiteSpace(request.Name)) teacher.Name = request.Name;
        if (request.Mobile != null) teacher.Mobile = request.Mobile;
        if (request.Subjects != null) teacher.Subjects = request.Subjects;
        if (request.AssignedClasses != null) teacher.AssignedClasses = request.AssignedClasses;
        teacher.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("تم تحديث المعلم بنجاح"));
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse>> DeleteTeacher(int id)
    {
        var teacher = await _db.Teachers.FindAsync(id);
        if (teacher == null)
            return Ok(ApiResponse.Fail("المعلم غير موجود"));

        _db.Teachers.Remove(teacher);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("تم حذف المعلم بنجاح"));
    }

    [HttpPost("import")]
    public async Task<ActionResult<ApiResponse>> ImportTeachers([FromBody] ImportTeachersRequest request)
    {
        int added = 0, updated = 0;

        foreach (var t in request.Teachers)
        {
            if (string.IsNullOrWhiteSpace(t.CivilId)) continue;

            var existing = await _db.Teachers.FirstOrDefaultAsync(x => x.CivilId == t.CivilId);
            if (existing != null)
            {
                if (request.UpdateExisting)
                {
                    if (!string.IsNullOrWhiteSpace(t.Name)) existing.Name = t.Name;
                    if (!string.IsNullOrEmpty(t.Mobile)) existing.Mobile = t.Mobile;
                    existing.UpdatedAt = DateTime.UtcNow;
                    updated++;
                }
            }
            else
            {
                _db.Teachers.Add(new Teacher
                {
                    CivilId = t.CivilId,
                    Name = t.Name ?? "",
                    Mobile = t.Mobile ?? "",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
                added++;
            }
        }

        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok($"تم الاستيراد: {added} جديد، {updated} محدّث"));
    }

    // معاينة ملف Excel قبل الاستيراد
    [HttpPost("preview-excel")]
    public async Task<ActionResult<ApiResponse<List<object>>>> PreviewExcel([FromForm] IFormFile file)
    {
        if (file == null || file.Length == 0)
            return Ok(ApiResponse.Fail("الملف مطلوب"));

        using var stream = file.OpenReadStream();
        using var workbook = new XLWorkbook(stream);
        var ws = FindBestWorksheet(workbook);

        var (colCivil, colName, colMobile, headerRowNum) = DetectColumns(ws);
        if (colName == 0)
            return Ok(ApiResponse.Fail("لم يتم العثور على عمود 'اسم المعلم' أو 'الاسم'"));

        var existingCivilIds = await _db.Teachers.Select(t => t.CivilId).ToListAsync();
        var existingSet = new HashSet<string>(existingCivilIds, StringComparer.Ordinal);

        var rows = new List<object>();
        for (int r = headerRowNum + 1; r <= ws.RowsUsed().Count(); r++)
        {
            var row = ws.Row(r);
            var name = row.Cell(colName).GetString().Trim();
            if (string.IsNullOrWhiteSpace(name)) continue;

            var civilId = colCivil > 0 ? row.Cell(colCivil).GetString().Trim() : "";
            var mobile = colMobile > 0 ? NormalizeMobile(row.Cell(colMobile).GetString().Trim()) : "";

            rows.Add(new
            {
                civilId,
                name,
                mobile,
                isExisting = !string.IsNullOrEmpty(civilId) && existingSet.Contains(civilId)
            });
        }

        return Ok(ApiResponse<List<object>>.Ok(rows));
    }

    // استيراد من ملف Excel
    [HttpPost("import-excel")]
    public async Task<ActionResult<ApiResponse>> ImportFromExcel(
        [FromForm] IFormFile file,
        [FromForm] bool updateExisting = false)
    {
        if (file == null || file.Length == 0)
            return Ok(ApiResponse.Fail("الملف مطلوب"));

        int added = 0, updated = 0, skipped = 0;

        using var stream = file.OpenReadStream();
        using var workbook = new XLWorkbook(stream);
        var ws = FindBestWorksheet(workbook);

        var (colCivil, colName, colMobile, headerRowNum) = DetectColumns(ws);
        if (colName == 0)
            return Ok(ApiResponse.Fail("لم يتم العثور على عمود 'اسم المعلم' أو 'الاسم'"));

        for (int r = headerRowNum + 1; r <= ws.RowsUsed().Count(); r++)
        {
            var row = ws.Row(r);
            var name = row.Cell(colName).GetString().Trim();
            if (string.IsNullOrWhiteSpace(name)) { skipped++; continue; }

            var civilId = colCivil > 0 ? row.Cell(colCivil).GetString().Trim() : "";
            var mobile = colMobile > 0 ? NormalizeMobile(row.Cell(colMobile).GetString().Trim()) : "";

            Teacher? existing = null;
            if (!string.IsNullOrEmpty(civilId))
                existing = await _db.Teachers.FirstOrDefaultAsync(t => t.CivilId == civilId);

            if (existing != null)
            {
                if (updateExisting)
                {
                    existing.Name = name;
                    if (!string.IsNullOrEmpty(mobile)) existing.Mobile = mobile;
                    existing.UpdatedAt = DateTime.UtcNow;
                    updated++;
                }
                else { skipped++; }
            }
            else
            {
                _db.Teachers.Add(new Teacher
                {
                    CivilId = civilId,
                    Name = name,
                    Mobile = mobile,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
                added++;
            }
        }

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            added, updated, skipped,
            message = $"تم الاستيراد: {added} جديد، {updated} محدّث، {skipped} متجاوز"
        }));
    }

    // ============================================================
    // Link Management
    // ============================================================

    [HttpPost("{id}/create-link")]
    public async Task<ActionResult<ApiResponse<object>>> CreateLink(int id, [FromServices] IAuthService authService)
    {
        var teacher = await _db.Teachers.FindAsync(id);
        if (teacher == null) return Ok(ApiResponse.Fail("المعلم غير موجود"));

        teacher.TokenLink = authService.GenerateTokenLink();
        teacher.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { tokenLink = teacher.TokenLink }));
    }

    [HttpPost("{id}/remove-link")]
    public async Task<ActionResult<ApiResponse>> RemoveLink(int id)
    {
        var teacher = await _db.Teachers.FindAsync(id);
        if (teacher == null) return Ok(ApiResponse.Fail("المعلم غير موجود"));

        teacher.TokenLink = "";
        teacher.LinkUrl = "";
        teacher.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("تم إلغاء الربط"));
    }

    /// <summary>إنشاء رابط بالبحث عن المعلم برقم الجوال — مطابق لـ createTeacherLinkByPhone_ في Server_TeacherInput.gs</summary>
    [HttpPost("create-link-by-phone")]
    public async Task<ActionResult<ApiResponse<object>>> CreateLinkByPhone(
        [FromBody] CreateLinkByPhoneRequest request, [FromServices] IAuthService authService)
    {
        if (string.IsNullOrEmpty(request.Phone))
            return BadRequest(ApiResponse<object>.Fail("رقم الجوال مطلوب"));

        var normalized = NormalizeMobile(request.Phone);
        var teacher = await _db.Teachers
            .FirstOrDefaultAsync(t => t.Mobile == normalized || t.Mobile == request.Phone);

        if (teacher == null)
            return Ok(ApiResponse<object>.Fail("لم يتم العثور على معلم بهذا الرقم"));

        teacher.TokenLink = authService.GenerateTokenLink();
        teacher.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            teacherId = teacher.Id,
            name = teacher.Name,
            tokenLink = teacher.TokenLink
        }));
    }

    [HttpPost("create-all-links")]
    public async Task<ActionResult<ApiResponse<object>>> CreateAllLinks([FromServices] IAuthService authService)
    {
        var teachers = await _db.Teachers.Where(t => t.IsActive).ToListAsync();
        int created = 0;
        foreach (var t in teachers)
        {
            if (string.IsNullOrEmpty(t.TokenLink))
            {
                t.TokenLink = authService.GenerateTokenLink();
                t.UpdatedAt = DateTime.UtcNow;
                created++;
            }
        }
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { created, total = teachers.Count }));
    }

    // تحويل رقم الجوال من 966XXXXXXXXX إلى 05XXXXXXXX
    private static string NormalizeMobile(string mobile)
    {
        if (string.IsNullOrEmpty(mobile)) return mobile;
        mobile = mobile.Replace(" ", "").Replace("-", "");
        if (mobile.StartsWith("966") && mobile.Length == 12)
            mobile = "0" + mobile[3..];
        else if (mobile.StartsWith("+966") && mobile.Length == 13)
            mobile = "0" + mobile[4..];
        return mobile;
    }

    // البحث عن أفضل ورقة عمل (Sheet2 لنظام نور أو الأولى)
    private static IXLWorksheet FindBestWorksheet(XLWorkbook workbook)
    {
        if (workbook.Worksheets.Count > 1)
        {
            var sheet2 = workbook.Worksheets.Skip(1).First();
            if (sheet2.RowsUsed().Count() > 1)
                return sheet2;
        }
        return workbook.Worksheets.First();
    }

    // كشف الأعمدة تلقائياً مع البحث عن صف الرؤوس
    private static (int colCivil, int colName, int colMobile, int headerRow) DetectColumns(IXLWorksheet ws)
    {
        // البحث عن صف الرؤوس في أول 10 صفوف
        for (int r = 1; r <= Math.Min(10, ws.RowsUsed().Count()); r++)
        {
            var colMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var row = ws.Row(r);
            for (int c = 1; c <= Math.Min(30, ws.ColumnsUsed().Count()); c++)
            {
                var val = row.Cell(c).GetString().Trim();
                if (!string.IsNullOrEmpty(val))
                    colMap[val] = c;
            }

            int cn = FindCol(colMap, "اسم المعلم", "الاسم", "Name", "اسم", "الإسم");
            if (cn > 0)
            {
                int cc = FindCol(colMap, "السجل المدني", "الهوية", "CivilId", "رقم الهوية", "سجل", "هوية");
                int cm = FindCol(colMap, "الجوال", "Mobile", "جوال", "رقم الجوال", "هاتف");
                return (cc, cn, cm, r);
            }
        }

        // fallback: الصف الأول كرؤوس
        var fallbackMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var headerRow = ws.Row(1);
        for (int c = 1; c <= ws.ColumnsUsed().Count(); c++)
        {
            var val = headerRow.Cell(c).GetString().Trim();
            if (!string.IsNullOrEmpty(val))
                fallbackMap[val] = c;
        }

        return (
            FindCol(fallbackMap, "السجل المدني", "الهوية", "CivilId", "رقم الهوية"),
            FindCol(fallbackMap, "اسم المعلم", "الاسم", "Name", "اسم"),
            FindCol(fallbackMap, "الجوال", "Mobile", "جوال", "رقم الجوال"),
            1
        );
    }

    private static int FindCol(Dictionary<string, int> map, params string[] names)
    {
        foreach (var n in names)
        {
            if (map.TryGetValue(n, out var col)) return col;
            var match = map.FirstOrDefault(kv => kv.Key.Contains(n) || n.Contains(kv.Key));
            if (match.Value > 0) return match.Value;
        }
        return 0;
    }
}

public class TeacherRequest
{
    public string CivilId { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Mobile { get; set; }
    public string? Subjects { get; set; }
    public string? AssignedClasses { get; set; }
}

public class ImportTeachersRequest
{
    public List<TeacherRequest> Teachers { get; set; } = new();
    public bool UpdateExisting { get; set; } = false;
}

public class CreateLinkByPhoneRequest
{
    public string Phone { get; set; } = "";
}
