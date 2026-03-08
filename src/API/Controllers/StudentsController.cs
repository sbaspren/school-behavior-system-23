using Microsoft.AspNetCore.Authorization;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SchoolBehaviorSystem.Application.DTOs.Responses;
using SchoolBehaviorSystem.Domain.Entities;
using SchoolBehaviorSystem.Domain.Enums;
using SchoolBehaviorSystem.Infrastructure.Data;

namespace SchoolBehaviorSystem.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class StudentsController : ControllerBase
{
    private readonly AppDbContext _db;

    public StudentsController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetStudents(
        [FromQuery] string? stage = null,
        [FromQuery] string? grade = null,
        [FromQuery] string? className = null)
    {
        var query = _db.Students.AsQueryable();

        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var stageEnum))
            query = query.Where(s => s.Stage == stageEnum);
        if (!string.IsNullOrEmpty(grade))
            query = query.Where(s => s.Grade == grade);
        if (!string.IsNullOrEmpty(className))
            query = query.Where(s => s.Class == className);

        var students = await query.Select(s => new
        {
            s.Id, s.StudentNumber, s.Name,
            stage = s.Stage.ToString(), s.Grade, className = s.Class,
            s.Mobile, s.CreatedAt
        }).OrderBy(s => s.Name).ToListAsync();

        return Ok(ApiResponse<List<object>>.Ok(students.Cast<object>().ToList()));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse>> AddStudent([FromBody] StudentRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return Ok(ApiResponse.Fail("الاسم مطلوب"));
        if (!Enum.TryParse<Stage>(request.Stage, true, out var stage))
            return Ok(ApiResponse.Fail("المرحلة غير صالحة"));

        // كشف التكرار برقم الطالب
        if (!string.IsNullOrEmpty(request.StudentNumber))
        {
            var exists = await _db.Students.AnyAsync(s => s.StudentNumber == request.StudentNumber);
            if (exists)
                return Ok(ApiResponse.Fail("رقم الطالب مسجل مسبقاً"));
        }

        var student = new Student
        {
            StudentNumber = request.StudentNumber ?? "",
            Name = request.Name,
            Stage = stage,
            Grade = request.Grade ?? "",
            Class = request.ClassName ?? "",
            Mobile = request.Mobile ?? "",
            CreatedAt = DateTime.UtcNow
        };

        _db.Students.Add(student);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("تم إضافة الطالب بنجاح"));
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse>> DeleteStudent(int id)
    {
        var student = await _db.Students.FindAsync(id);
        if (student == null)
            return Ok(ApiResponse.Fail("الطالب غير موجود"));

        _db.Students.Remove(student);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok("تم حذف الطالب بنجاح"));
    }

    [HttpPost("import")]
    public async Task<ActionResult<ApiResponse>> ImportStudents([FromBody] ImportStudentsRequest request)
    {
        if (!Enum.TryParse<Stage>(request.Stage, true, out var stage))
            return Ok(ApiResponse.Fail("المرحلة غير صالحة"));

        int added = 0, updated = 0;

        foreach (var s in request.Students)
        {
            if (string.IsNullOrWhiteSpace(s.Name)) continue;

            Student? existing = null;
            if (!string.IsNullOrEmpty(s.StudentNumber))
                existing = await _db.Students.FirstOrDefaultAsync(x => x.StudentNumber == s.StudentNumber);

            if (existing != null)
            {
                existing.Name = s.Name;
                if (!string.IsNullOrEmpty(s.Grade)) existing.Grade = s.Grade;
                if (!string.IsNullOrEmpty(s.ClassName)) existing.Class = s.ClassName;
                if (!string.IsNullOrEmpty(s.Mobile)) existing.Mobile = s.Mobile;
                existing.Stage = stage;
                updated++;
            }
            else
            {
                _db.Students.Add(new Student
                {
                    StudentNumber = s.StudentNumber ?? "",
                    Name = s.Name,
                    Stage = stage,
                    Grade = s.Grade ?? "",
                    Class = s.ClassName ?? "",
                    Mobile = s.Mobile ?? "",
                    CreatedAt = DateTime.UtcNow
                });
                added++;
            }
        }

        await _db.SaveChangesAsync();

        return Ok(ApiResponse.Ok($"تم الاستيراد: {added} جديد، {updated} محدّث"));
    }

    // معاينة ملف Excel قبل الاستيراد — مطابق لـ processUploadedFile في Server_Settings.gs سطر 728-792
    [HttpPost("preview-excel")]
    public async Task<ActionResult<ApiResponse<object>>> PreviewExcel([FromForm] IFormFile file)
    {
        if (file == null || file.Length == 0)
            return Ok(ApiResponse.Fail("الملف مطلوب"));

        using var stream = file.OpenReadStream();
        using var workbook = new XLWorkbook(stream);
        var ws = FindBestWorksheet(workbook);

        var (colNumber, colName, colGrade, colClass, colMobile, headerRowNum) = DetectStudentColumns(ws);
        if (colName == 0)
            return Ok(ApiResponse.Fail("لم يتم العثور على عمود 'اسم الطالب' أو 'الاسم'"));

        // استخراج الرؤوس
        var headers = new List<string>();
        for (int c = 1; c <= Math.Min(30, ws.ColumnsUsed().Count()); c++)
        {
            headers.Add(ws.Row(headerRowNum).Cell(c).GetString().Trim());
        }

        // معاينة أول 10 صفوف
        var preview = new List<List<string>>();
        for (int r = headerRowNum; r <= Math.Min(headerRowNum + 10, ws.RowsUsed().Count()); r++)
        {
            var row = new List<string>();
            for (int c = 1; c <= headers.Count; c++)
            {
                row.Add(ws.Row(r).Cell(c).GetString().Trim());
            }
            preview.Add(row);
        }

        // عدد الصفوف الفعلية
        int totalRows = 0;
        for (int r = headerRowNum + 1; r <= ws.RowsUsed().Count(); r++)
        {
            var name = colName > 0 ? ws.Row(r).Cell(colName).GetString().Trim() : "";
            if (!string.IsNullOrWhiteSpace(name)) totalRows++;
        }

        // كشف التكرار مع الموجود
        var existingNumbers = await _db.Students
            .Where(s => !string.IsNullOrEmpty(s.StudentNumber))
            .Select(s => s.StudentNumber)
            .ToListAsync();
        var existingSet = new HashSet<string>(existingNumbers, StringComparer.Ordinal);

        // مطابق لـ processUploadedFile → columns object
        return Ok(ApiResponse<object>.Ok(new
        {
            headers,
            preview,
            totalRows,
            columns = new
            {
                studentId = colNumber > 0 ? colNumber - 1 : -1,
                name = colName > 0 ? colName - 1 : -1,
                grade = colGrade > 0 ? colGrade - 1 : -1,
                classVal = colClass > 0 ? colClass - 1 : -1,
                mobile = colMobile > 0 ? colMobile - 1 : -1,
            },
            existingCount = existingSet.Count
        }));
    }

    // استيراد من ملف Excel
    [HttpPost("import-excel")]
    public async Task<ActionResult<ApiResponse>> ImportFromExcel(
        [FromForm] IFormFile file,
        [FromForm] string? stage = null)
    {
        if (file == null || file.Length == 0)
            return Ok(ApiResponse.Fail("الملف مطلوب"));

        // المرحلة اختيارية — إذا لم تُحدد سيتم كشفها تلقائياً من اسم الصف
        Stage? stageEnum = null;
        if (!string.IsNullOrEmpty(stage) && Enum.TryParse<Stage>(stage, true, out var parsed))
            stageEnum = parsed;

        int added = 0, updated = 0, skipped = 0;

        using var stream = file.OpenReadStream();
        using var workbook = new XLWorkbook(stream);
        var ws = FindBestWorksheet(workbook);

        var (colNumber, colName, colGrade, colClass, colMobile, headerRowNum) = DetectStudentColumns(ws);

        if (colName == 0)
            return Ok(ApiResponse.Fail("لم يتم العثور على عمود 'اسم الطالب' أو 'الاسم'"));

        for (int r = headerRowNum + 1; r <= ws.RowsUsed().Count(); r++)
        {
            var row = ws.Row(r);
            var name = row.Cell(colName).GetString().Trim();
            if (string.IsNullOrWhiteSpace(name)) { skipped++; continue; }

            var studentNumber = colNumber > 0 ? row.Cell(colNumber).GetString().Trim() : "";
            var grade = colGrade > 0 ? row.Cell(colGrade).GetString().Trim() : "";
            var className = colClass > 0 ? row.Cell(colClass).GetString().Trim() : "";
            var mobile = colMobile > 0 ? NormalizeMobile(row.Cell(colMobile).GetString().Trim()) : "";

            // كشف المرحلة تلقائياً من اسم الصف إذا لم تُحدد
            var rowStage = stageEnum ?? DetectStageFromGrade(grade);
            if (rowStage == null) { skipped++; continue; }

            // تنظيف اسم الصف من اسم المرحلة
            grade = CleanGradeName(grade);

            Student? existing = null;
            if (!string.IsNullOrEmpty(studentNumber))
                existing = await _db.Students.FirstOrDefaultAsync(s => s.StudentNumber == studentNumber);

            if (existing != null)
            {
                existing.Name = name;
                if (!string.IsNullOrEmpty(grade)) existing.Grade = grade;
                if (!string.IsNullOrEmpty(className)) existing.Class = className;
                if (!string.IsNullOrEmpty(mobile)) existing.Mobile = mobile;
                existing.Stage = rowStage.Value;
                updated++;
            }
            else
            {
                _db.Students.Add(new Student
                {
                    StudentNumber = studentNumber,
                    Name = name,
                    Stage = rowStage.Value,
                    Grade = grade,
                    Class = className,
                    Mobile = mobile,
                    CreatedAt = DateTime.UtcNow
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

    // كشف المرحلة تلقائياً من اسم الصف
    private static Stage? DetectStageFromGrade(string grade)
    {
        if (string.IsNullOrEmpty(grade)) return null;
        if (grade.Contains("طفولة") || grade.Contains("روضة")) return Stage.Kindergarten;
        if (grade.Contains("ابتدائي") || grade.Contains("إبتدائي")) return Stage.Primary;
        if (grade.Contains("متوسط")) return Stage.Intermediate;
        if (grade.Contains("ثانوي")) return Stage.Secondary;
        return null;
    }

    // تنظيف اسم الصف من اسم المرحلة
    private static string CleanGradeName(string grade)
    {
        if (string.IsNullOrEmpty(grade)) return grade;
        string[] prefixes = ["ابتدائي", "إبتدائي", "متوسط", "ثانوي", "طفولة مبكرة", "روضة"];
        foreach (var prefix in prefixes)
        {
            grade = grade.Replace(prefix, "").Trim();
            grade = grade.TrimStart(' ', '-', '/');
        }
        return grade.Trim();
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
    private static (int colNumber, int colName, int colGrade, int colClass, int colMobile, int headerRow) DetectStudentColumns(IXLWorksheet ws)
    {
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

            int cn = FindCol(colMap, "اسم الطالب", "الاسم", "Name", "اسم", "الإسم");
            if (cn > 0)
            {
                return (
                    FindCol(colMap, "رقم الطالب", "الرقم", "StudentNumber", "رقم", "رقم_الطالب"),
                    cn,
                    FindCol(colMap, "الصف", "Grade", "صف", "رقم صف"),
                    FindCol(colMap, "الفصل", "Class", "فصل"),
                    FindCol(colMap, "الجوال", "Mobile", "جوال", "رقم الجوال", "هاتف"),
                    r
                );
            }
        }

        // fallback
        var fallbackMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var headerRow = ws.Row(1);
        for (int c = 1; c <= ws.ColumnsUsed().Count(); c++)
        {
            var val = headerRow.Cell(c).GetString().Trim();
            if (!string.IsNullOrEmpty(val))
                fallbackMap[val] = c;
        }

        return (
            FindCol(fallbackMap, "رقم الطالب", "الرقم", "StudentNumber", "رقم"),
            FindCol(fallbackMap, "اسم الطالب", "الاسم", "Name", "اسم"),
            FindCol(fallbackMap, "الصف", "Grade", "صف"),
            FindCol(fallbackMap, "الفصل", "Class", "فصل"),
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

public class StudentRequest
{
    public string? StudentNumber { get; set; }
    public string Name { get; set; } = "";
    public string? Stage { get; set; }
    public string? Grade { get; set; }
    public string? ClassName { get; set; }
    public string? Mobile { get; set; }
}

public class ImportStudentsRequest
{
    public string Stage { get; set; } = "";
    public List<StudentRequest> Students { get; set; } = new();
}
