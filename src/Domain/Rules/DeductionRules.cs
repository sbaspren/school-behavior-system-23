using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Rules;

public static class DeductionRules
{
    // قواعد الحسم حسب الدرجة والتكرار (مطابقة للنظام الأصلي)
    private static readonly Dictionary<ViolationDegree, int[]> DeductionByDegree = new()
    {
        { ViolationDegree.First,  new[] { 0, 0, 1, 1 } },      // الدرجة 1: تكرار 1=0, 2=0, 3=1, 4=1
        { ViolationDegree.Second, new[] { 2, 0, 0 } },          // الدرجة 2: تكرار 1=2, 2=0, 3=0
        { ViolationDegree.Third,  new[] { 3, 0 } },             // الدرجة 3: تكرار 1=3, 2=0
        { ViolationDegree.Fourth, new[] { 10, 0 } },            // الدرجة 4: تكرار 1=10, 2=0
        { ViolationDegree.Fifth,  new[] { 15 } }                // الدرجة 5: تكرار 1=15
    };

    public static int GetDeduction(ViolationDegree degree, int repetition)
    {
        if (!DeductionByDegree.TryGetValue(degree, out var deductions))
            return 0;

        var index = Math.Min(repetition - 1, deductions.Length - 1);
        if (index < 0) return 0;
        return deductions[index];
    }

    /// <summary>إرجاع خريطة الحسم الكاملة — مطابق لـ DEDUCTION_BY_DEGREE في Server_Data.gs سطر 154-160</summary>
    public static Dictionary<int, Dictionary<int, int>> GetDeductionMap()
    {
        var result = new Dictionary<int, Dictionary<int, int>>
        {
            { 1, new() { {1, 0}, {2, 0}, {3, 1}, {4, 1} } },
            { 2, new() { {1, 2}, {2, 0}, {3, 0}, {4, 0} } },
            { 3, new() { {1, 3}, {2, 0}, {3, 0} } },
            { 4, new() { {1, 10}, {2, 0} } },
            { 5, new() { {1, 15} } }
        };
        return result;
    }
}
