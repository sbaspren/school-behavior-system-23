using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Rules;

/// <summary>
/// قوالب الإجراءات حسب الدرجة والتكرار — مطابق لـ PROCEDURES_BY_DEGREE في Server_Data.gs سطر 163-188
/// كل إجراء يحتوي على نص + اسم النموذج المرتبط (إن وجد)
/// </summary>
public static class ProcedureRules
{
    public record ProcedureStep(string Text, string? FormName = null);

    private static readonly Dictionary<string, ProcedureStep[]> ProceduresByDegreeAndRep = new()
    {
        // ══════════════════════════════════════════════════════════════
        // الدرجة الأولى
        // ══════════════════════════════════════════════════════════════
        { "1_1", new[] {
            new ProcedureStep("التنبيه الشفهي الأول من المعلم أو إدارة المدرسة")
        }},
        { "1_2", new[] {
            new ProcedureStep("التنبيه الشفهي الثاني من المعلم أو إدارة المدرسة"),
            new ProcedureStep("ملاحظة الطالب وحصر سلوكياته")
        }},
        { "1_3", new[] {
            new ProcedureStep("تدوين المشكلة من المعلم"),
            new ProcedureStep("أخذ توقيع الطالب عليها"),
            new ProcedureStep("إشعار ولي الأمر هاتفيًا", "إشعار ولي الأمر"),
            new ProcedureStep("حسم درجة واحدة"),
            new ProcedureStep("تمكين الطالب من فرص التعويض", "فرص تعويض"),
            new ProcedureStep("تحويل الطالب للموجه الطلابي", "إحالة طالب")
        }},
        { "1_4", new[] {
            new ProcedureStep("دعوة ولي أمر الطالب", "دعوة ولي الأمر"),
            new ProcedureStep("الاتفاق على خطة لتعديل السلوك"),
            new ProcedureStep("حسم درجة واحدة"),
            new ProcedureStep("تمكين الطالب من فرص التعويض", "فرص تعويض"),
            new ProcedureStep("تحويل الطالب للجنة التوجيه الطلابي"),
            new ProcedureStep("متابعة الموجه الطلابي للحالة")
        }},

        // ══════════════════════════════════════════════════════════════
        // الدرجة الثانية
        // ══════════════════════════════════════════════════════════════
        { "2_1", new[] {
            new ProcedureStep("إشعار ولي الأمر هاتفيًا", "إشعار ولي الأمر"),
            new ProcedureStep("حسم درجتين"),
            new ProcedureStep("تمكين من فرص التعويض", "فرص تعويض"),
            new ProcedureStep("أخذ تعهد خطي", "تعهد سلوكي"),
            new ProcedureStep("تحويل للموجه الطلابي", "إحالة طالب")
        }},
        { "2_2", new[] {
            new ProcedureStep("تنفيذ جميع ما ورد في الإجراء الأول"),
            new ProcedureStep("دعوة ولي أمر الطالب حضوريًا", "دعوة ولي الأمر"),
            new ProcedureStep("وضع برنامج وقائي"),
            new ProcedureStep("متابعة الحالة من الموجه")
        }},
        { "2_3", new[] {
            new ProcedureStep("تنفيذ جميع ما ورد في الإجراء الثاني"),
            new ProcedureStep("نقل الطالب إلى فصل آخر"),
            new ProcedureStep("تحويل الطالب للجنة التوجيه")
        }},
        { "2_4", new[] {
            new ProcedureStep("دعوة ولي أمر الطالب", "دعوة ولي الأمر"),
            new ProcedureStep("تحويل الطالب للجنة التوجيه الطلابي")
        }},

        // ══════════════════════════════════════════════════════════════
        // الدرجة الثالثة
        // ══════════════════════════════════════════════════════════════
        { "3_1", new[] {
            new ProcedureStep("دعوة ولي أمر الطالب وتوضيح الإجراءات", "دعوة ولي الأمر"),
            new ProcedureStep("وضع برنامج وقائي"),
            new ProcedureStep("أخذ تعهد خطي وتوقيع ولي الأمر", "تعهد سلوكي"),
            new ProcedureStep("حسم 3 درجات"),
            new ProcedureStep("تمكين من فرص التعويض", "فرص تعويض"),
            new ProcedureStep("إلزام الطالب بالاعتذار"),
            new ProcedureStep("إلزام الطالب بإصلاح ما أتلفه"),
            new ProcedureStep("مصادرة المواد الممنوعة"),
            new ProcedureStep("تحويل للموجه الطلابي", "إحالة طالب")
        }},
        { "3_2", new[] {
            new ProcedureStep("تنفيذ جميع ما ورد في الإجراء الأول"),
            new ProcedureStep("دعوة ولي أمر الطالب وإنذار الطالب كتابيًا بالنقل", "دعوة ولي الأمر"),
            new ProcedureStep("أخذ توقيع ولي الأمر بالعلم"),
            new ProcedureStep("تحويل الحالة للجنة التوجيه"),
            new ProcedureStep("نقل الطالب المخالف لفصل آخر"),
            new ProcedureStep("متابعة الحالة من الموجه")
        }},
        { "3_3", new[] {
            new ProcedureStep("تنفيذ جميع ما ورد في الإجراء الأول"),
            new ProcedureStep("رفع محضر لإدارة التعليم", "محضر ضبط واقعة"),
            new ProcedureStep("إصدار قرار بالنقل من مدير التعليم"),
            new ProcedureStep("متابعة الحالة في المدرسة الجديدة")
        }},

        // ══════════════════════════════════════════════════════════════
        // الدرجة الرابعة
        // ══════════════════════════════════════════════════════════════
        { "4_1", new[] {
            new ProcedureStep("دعوة ولي أمر الطالب وإنذاره بالنقل", "دعوة ولي الأمر"),
            new ProcedureStep("أخذ تعهد خطي وتوقيع ولي الأمر", "تعهد سلوكي"),
            new ProcedureStep("حسم 10 درجات"),
            new ProcedureStep("تمكين من فرص التعويض", "فرص تعويض"),
            new ProcedureStep("إلزام الطالب بالاعتذار"),
            new ProcedureStep("إلزام الطالب بإصلاح ما أتلفه"),
            new ProcedureStep("مصادرة المواد الممنوعة"),
            new ProcedureStep("نقل الطالب لفصل آخر"),
            new ProcedureStep("متابعة الحالة من الموجه")
        }},
        { "4_2", new[] {
            new ProcedureStep("تنفيذ جميع ما ورد في الإجراء الأول (باستثناء نقل الفصل)"),
            new ProcedureStep("رفع محضر لإدارة التعليم", "محضر ضبط واقعة"),
            new ProcedureStep("إصدار قرار بالنقل من مدير التعليم"),
            new ProcedureStep("تمكين من فرص التعويض بالمدرسة الجديدة", "فرص تعويض"),
            new ProcedureStep("متابعة الحالة في المدرسة الجديدة")
        }},

        // ══════════════════════════════════════════════════════════════
        // الدرجة الخامسة
        // ══════════════════════════════════════════════════════════════
        { "5_1", new[] {
            new ProcedureStep("تدوين محضر من إدارة المدرسة", "محضر ضبط واقعة"),
            new ProcedureStep("دعوة ولي أمر الطالب وتبليغه", "دعوة ولي الأمر"),
            new ProcedureStep("حسم 15 درجة"),
            new ProcedureStep("تمكين من فرص التعويض بالمدرسة الجديدة", "فرص تعويض"),
            new ProcedureStep("عقد اجتماع للجنة التوجيه", "محضر اجتماع لجنة"),
            new ProcedureStep("رفع محضر لإدارة التعليم"),
            new ProcedureStep("إصدار قرار بالنقل من مدير التعليم"),
            new ProcedureStep("متابعة الحالة في المدرسة الجديدة")
        }}
    };

    /// <summary>إرجاع إجراءات الدرجة والتكرار مع بيانات النموذج</summary>
    public static ProcedureStep[] GetProcedureSteps(ViolationDegree degree, int repetition)
    {
        var key = $"{(int)degree}_{repetition}";
        if (ProceduresByDegreeAndRep.TryGetValue(key, out var procedures))
            return procedures;

        // إذا التكرار أعلى من المتاح، أرجع آخر تكرار معرّف
        for (int r = repetition; r >= 1; r--)
        {
            key = $"{(int)degree}_{r}";
            if (ProceduresByDegreeAndRep.TryGetValue(key, out procedures))
                return procedures;
        }

        return Array.Empty<ProcedureStep>();
    }

    /// <summary>إرجاع نصوص الإجراءات فقط (بدون formName) — للتوافق مع الكود الحالي</summary>
    public static string[] GetProcedures(ViolationDegree degree, int repetition)
    {
        return GetProcedureSteps(degree, repetition).Select(p => p.Text).ToArray();
    }

    /// <summary>إرجاع خريطة الإجراءات الكاملة — مطابق لـ proceduresByDegree في getInitialData</summary>
    public static Dictionary<int, Dictionary<string, object[]>> GetAllProceduresByDegree()
    {
        var result = new Dictionary<int, Dictionary<string, object[]>>();

        foreach (var kv in ProceduresByDegreeAndRep)
        {
            var parts = kv.Key.Split('_');
            var degree = int.Parse(parts[0]);
            var rep = parts[1];

            if (!result.ContainsKey(degree))
                result[degree] = new Dictionary<string, object[]>();

            result[degree][rep] = kv.Value.Select(p => (object)new
            {
                text = "- " + p.Text,
                formName = p.FormName
            }).ToArray();
        }

        return result;
    }
}
