namespace SchoolBehaviorSystem.Domain.Enums;

public enum AbsenceType
{
    FullDay,    // يوم كامل
    Period      // حصة
}

public enum ExcuseType
{
    Excused,    // بعذر
    Unexcused   // بدون عذر
}

public enum AbsenceStatus
{
    Pending,    // معلق
    Approved,   // معتمد
    Rejected    // مرفوض
}
