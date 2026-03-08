using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SchoolBehaviorSystem.Application.DTOs.Responses;
using SchoolBehaviorSystem.Domain.Rules;

namespace SchoolBehaviorSystem.API.Controllers;

/// <summary>
/// كتالوج المخالفات والإجراءات الثابتة — مطابق لـ getRulesData_() في Server_Data.gs سطر 190-331
/// هذه بيانات تنظيمية من لائحة السلوك والمواظبة 1447 — لا تتغير من مدرسة لأخرى
/// </summary>
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class RulesController : ControllerBase
{
    /// <summary>
    /// إرجاع جميع بيانات القواعد — مطابق لـ getInitialData → getRulesData_()
    /// </summary>
    [HttpGet]
    public ActionResult<ApiResponse<object>> GetRules([FromQuery] string? stage = null)
    {
        var allViolations = ViolationsCatalog.GetAll();

        // فلترة حسب المرحلة إذا طُلب
        var violations = allViolations;
        if (!string.IsNullOrEmpty(stage))
        {
            violations = allViolations
                .Where(v => v.StageScope == "الكل"
                    || (stage == "ابتدائي" && v.StageScope == "ابتدائي")
                    || (stage != "ابتدائي" && v.StageScope == "متوسط وثانوي"))
                .ToList();
        }

        // إعداد الاستجابة بنفس شكل الأصلي
        var violationsData = violations.Select(v => new
        {
            id = v.Id,
            stage = v.StageScope,
            type = v.Type,
            degree = v.Degree,
            degree_ابتدائي = v.DegreeElementary,
            text = v.Text
        }).ToList();

        // توليد خريطة الإجراءات حسب ID — مطابق لـ Server_Data.gs سطر 320-323
        var procedures = new Dictionary<int, object>();
        foreach (var v in violations)
        {
            var effectiveDegree = v.Degree;
            procedures[v.Id] = ProcedureRules.GetAllProceduresByDegree()
                .GetValueOrDefault(effectiveDegree, new Dictionary<string, object[]>());
        }

        return Ok(ApiResponse<object>.Ok(new
        {
            violations = violationsData,
            procedures,
            proceduresByDegree = ProcedureRules.GetAllProceduresByDegree(),
            deductionMap = DeductionRules.GetDeductionMap()
        }));
    }

    /// <summary>
    /// إرجاع الدرجة الفعلية للمخالفة حسب المرحلة — مطابق لـ getEffectiveDegree_ في Server_Data.gs سطر 351-357
    /// </summary>
    [HttpGet("effective-degree")]
    public ActionResult<ApiResponse<object>> GetEffectiveDegree(
        [FromQuery] int violationId, [FromQuery] string? stage = null)
    {
        var violation = ViolationsCatalog.GetById(violationId);
        if (violation == null)
            return Ok(ApiResponse<object>.Fail("المخالفة غير موجودة"));

        var effectiveDegree = violation.Degree;
        if (stage == "ابتدائي" && violation.DegreeElementary.HasValue)
            effectiveDegree = violation.DegreeElementary.Value;

        var deduction = DeductionRules.GetDeductionMap()
            .GetValueOrDefault(effectiveDegree, new Dictionary<int, int>());

        return Ok(ApiResponse<object>.Ok(new
        {
            violationId,
            stage = stage ?? "متوسط",
            originalDegree = violation.Degree,
            effectiveDegree,
            deductionByRepetition = deduction
        }));
    }

    /// <summary>
    /// حساب الحسم لمخالفة — مطابق لـ getDeductionForViolation_ في Server_Data.gs سطر 366-372
    /// </summary>
    [HttpGet("deduction")]
    public ActionResult<ApiResponse<object>> GetDeduction(
        [FromQuery] int violationId, [FromQuery] int repeatLevel = 1, [FromQuery] string? stage = null)
    {
        var violation = ViolationsCatalog.GetById(violationId);
        if (violation == null)
            return Ok(ApiResponse<object>.Fail("المخالفة غير موجودة"));

        var effectiveDegree = violation.Degree;
        if (stage == "ابتدائي" && violation.DegreeElementary.HasValue)
            effectiveDegree = violation.DegreeElementary.Value;

        var deductionMap = DeductionRules.GetDeductionMap();
        int deduction = 0;
        if (deductionMap.TryGetValue(effectiveDegree, out var repMap) && repMap.TryGetValue(repeatLevel, out var d))
            deduction = d;

        return Ok(ApiResponse<object>.Ok(new
        {
            violationId,
            effectiveDegree,
            repeatLevel,
            deduction
        }));
    }
}
