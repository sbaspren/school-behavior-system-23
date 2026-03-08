using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SchoolBehaviorSystem.Domain.Enums;
using SchoolBehaviorSystem.Infrastructure.Data;

namespace SchoolBehaviorSystem.API.Controllers;

/// <summary>
/// خدمة إضافة "رصد الغياب" — مطابق لـ Server_Extension.gs سطر 1-148
/// الإضافة تسحب البيانات عبر GET /api/extension/absence
/// الخرج: { medium: [{name, grade, periods}], high: [{name, grade, periods}] }
/// </summary>
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ExtensionController : ControllerBase
{
    private readonly AppDbContext _db;

    public ExtensionController(AppDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// الدالة الرئيسية — مطابق لـ getExtensionAbsenceData() سطر 12-28
    /// </summary>
    [HttpGet("absence")]
    public async Task<ActionResult<object>> GetAbsenceData()
    {
        // تاريخ اليوم هجري — مطابق للفلترة بالتاريخ في الأصل (سطر 69-100)
        var now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow,
            TimeZoneInfo.FindSystemTimeZoneById("Arab Standard Time"));
        var todayStart = now.Date;

        // جلب غياب اليوم لكل المراحل
        var todayAbsences = await _db.DailyAbsences
            .Where(a => a.RecordedAt >= todayStart.ToUniversalTime()
                     && a.RecordedAt < todayStart.AddDays(1).ToUniversalTime())
            .Select(a => new
            {
                a.StudentName,
                a.Grade,
                a.Stage,
                a.AbsenceType
            })
            .ToListAsync();

        // تجميع بمفتاح "اسم|صف|مرحلة" — مطابق لسطر 114-131
        var stageGroups = new Dictionary<string, List<object>>();

        // خريطة المراحل — مطابق لسطر 19
        var stageToKey = new Dictionary<Stage, string>
        {
            [Stage.Kindergarten] = "kindergarten",
            [Stage.Primary] = "primary",
            [Stage.Intermediate] = "medium",
            [Stage.Secondary] = "high"
        };

        // تجميع الطلاب حسب المرحلة
        var grouped = todayAbsences
            .GroupBy(a => a.Stage)
            .ToDictionary(g => g.Key, g => g.ToList());

        foreach (var (stage, records) in grouped)
        {
            var key = stageToKey.GetValueOrDefault(stage, stage.ToString().ToLower());

            // تجميع بمفتاح "اسم|صف" — مطابق لسطر 114-131
            var studentMap = new Dictionary<string, (string Name, string Grade, bool HasFullDay, int PeriodCount)>();

            foreach (var r in records)
            {
                var mapKey = $"{r.StudentName}|{r.Grade}";
                var isFullDay = r.AbsenceType == AbsenceType.FullDay;

                if (studentMap.TryGetValue(mapKey, out var existing))
                {
                    studentMap[mapKey] = (
                        existing.Name,
                        existing.Grade,
                        existing.HasFullDay || isFullDay,
                        isFullDay ? existing.PeriodCount : existing.PeriodCount + 1
                    );
                }
                else
                {
                    studentMap[mapKey] = (r.StudentName, r.Grade, isFullDay, isFullDay ? 0 : 1);
                }
            }

            // تحويل لشكل الإضافة — مطابق لسطر 135-144
            var result = studentMap.Values.Select(s => new
            {
                name = s.Name,
                grade = s.Grade,
                periods = s.HasFullDay ? 6 : s.PeriodCount
            }).ToList<object>();

            stageGroups[key] = result;
        }

        // ضمان وجود مفاتيح المراحل المفعّلة حتى لو فارغة
        foreach (var kvp in stageToKey)
        {
            var key = kvp.Value;
            if (!stageGroups.ContainsKey(key))
            {
                // فقط إذا كانت المرحلة مفعّلة
                var stageEnabled = await _db.StageConfigs.AnyAsync(s => s.Stage == kvp.Key && s.IsEnabled);
                if (stageEnabled)
                    stageGroups[key] = new List<object>();
            }
        }

        return Ok(stageGroups);
    }
}
