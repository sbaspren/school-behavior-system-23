using SchoolBehaviorSystem.Domain.Entities;
using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Infrastructure.Data;

public static class DataSeeder
{
    public static async Task SeedAsync(AppDbContext db)
    {
        var changed = false;

        // 1. إعدادات المدرسة الافتراضية
        if (!db.SchoolSettings.Any())
        {
            db.SchoolSettings.Add(new SchoolSettings
            {
                SchoolName = "مدرسة نموذجية",
                EduAdmin = "إدارة التعليم",
                EduDept = "وزارة التعليم",
            });
            changed = true;
        }

        // 2. مستخدم مدير افتراضي (جوال: 0500000000 / كلمة المرور: admin123)
        if (!db.Users.Any())
        {
            db.Users.Add(new User
            {
                Name = "مدير النظام",
                Role = UserRole.Admin,
                Mobile = "0500000000",
                Email = "admin@school.sa",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                ScopeType = "all",
                IsActive = true,
                TokenLink = Guid.NewGuid().ToString("N"),
            });
            changed = true;
        }

        // 3. تعريفات المخالفات (160+ مخالفة حسب النظام السعودي)
        if (!db.ViolationTypeDefs.Any())
        {
            var defs = GetViolationTypeDefs();
            db.ViolationTypeDefs.AddRange(defs);
            changed = true;
        }

        if (changed)
            await db.SaveChangesAsync();
    }

    private static List<ViolationTypeDef> GetViolationTypeDefs()
    {
        var list = new List<ViolationTypeDef>();

        // ═══════════════════════════════════════
        // الدرجة الأولى - مخالفات بسيطة
        // ═══════════════════════════════════════
        AddDef(list, "101", "العبث بالمقاعد والطاولات والأدوات المدرسية", "سلوكية", ViolationDegree.First);
        AddDef(list, "102", "عدم الالتزام بالزي المدرسي المعتمد", "سلوكية", ViolationDegree.First);
        AddDef(list, "103", "عدم أداء الصلاة مع الجماعة", "سلوكية", ViolationDegree.First);
        AddDef(list, "104", "عدم إحضار الكتب والأدوات المدرسية", "تعليمية", ViolationDegree.First);
        AddDef(list, "105", "التأخر عن الطابور الصباحي", "سلوكية", ViolationDegree.First);
        AddDef(list, "106", "التأخر عن الحصص", "سلوكية", ViolationDegree.First);
        AddDef(list, "107", "النوم أثناء الحصص", "تعليمية", ViolationDegree.First);
        AddDef(list, "108", "الأكل والشرب داخل الفصل", "سلوكية", ViolationDegree.First);
        AddDef(list, "109", "رمي المخلفات في غير الأماكن المخصصة", "سلوكية", ViolationDegree.First);
        AddDef(list, "110", "إصدار أصوات مزعجة أو ضوضاء في الفصل", "سلوكية", ViolationDegree.First);
        AddDef(list, "111", "عدم الاهتمام بالنظافة الشخصية", "سلوكية", ViolationDegree.First);
        AddDef(list, "112", "مخالفة آداب الطريق داخل المدرسة", "سلوكية", ViolationDegree.First);
        AddDef(list, "113", "تبادل الأغراض الشخصية بين الطلاب", "سلوكية", ViolationDegree.First);
        AddDef(list, "114", "الخروج من الفصل بدون إذن المعلم", "سلوكية", ViolationDegree.First);
        AddDef(list, "115", "عدم أداء الواجبات المنزلية", "تعليمية", ViolationDegree.First);
        AddDef(list, "116", "عدم إحضار ولي الأمر عند الطلب", "سلوكية", ViolationDegree.First);
        AddDef(list, "117", "إطالة الشعر بشكل مخالف", "سلوكية", ViolationDegree.First);
        AddDef(list, "118", "استخدام عبارات غير لائقة بين الطلاب", "سلوكية", ViolationDegree.First);
        AddDef(list, "119", "عدم احترام نظام الصف والطابور", "سلوكية", ViolationDegree.First);
        AddDef(list, "120", "التأخر في العودة من الفسحة", "سلوكية", ViolationDegree.First);

        // ═══════════════════════════════════════
        // الدرجة الثانية - مخالفات متوسطة
        // ═══════════════════════════════════════
        AddDef(list, "201", "تكرار مخالفات الدرجة الأولى", "سلوكية", ViolationDegree.Second);
        AddDef(list, "202", "التنمر اللفظي على الطلاب", "سلوكية", ViolationDegree.Second);
        AddDef(list, "203", "إثارة الفوضى في الفصل أو المدرسة", "سلوكية", ViolationDegree.Second);
        AddDef(list, "204", "عدم احترام المعلم أو موظفي المدرسة", "سلوكية", ViolationDegree.Second);
        AddDef(list, "205", "الغياب بدون عذر مقبول", "سلوكية", ViolationDegree.Second);
        AddDef(list, "206", "الكتابة على الجدران وتشويه الممتلكات", "سلوكية", ViolationDegree.Second);
        AddDef(list, "207", "التصوير داخل المدرسة بدون إذن", "سلوكية", ViolationDegree.Second);
        AddDef(list, "208", "إحضار أجهزة إلكترونية بدون إذن", "سلوكية", ViolationDegree.Second);
        AddDef(list, "209", "مخالفة تعليمات السلامة المدرسية", "سلوكية", ViolationDegree.Second);
        AddDef(list, "210", "تزوير توقيع ولي الأمر", "سلوكية", ViolationDegree.Second);
        AddDef(list, "211", "الغش في الاختبارات القصيرة", "تعليمية", ViolationDegree.Second);
        AddDef(list, "212", "رفض أداء الأنشطة الصفية", "تعليمية", ViolationDegree.Second);
        AddDef(list, "213", "الاعتداء اللفظي على الزملاء", "سلوكية", ViolationDegree.Second);
        AddDef(list, "214", "العبث بممتلكات الآخرين", "سلوكية", ViolationDegree.Second);
        AddDef(list, "215", "التدخين الإلكتروني أو حيازة أدواته", "سلوكية", ViolationDegree.Second);
        AddDef(list, "216", "إحضار مواد غذائية ممنوعة", "سلوكية", ViolationDegree.Second);
        AddDef(list, "217", "المشاجرة البسيطة بين الطلاب", "سلوكية", ViolationDegree.Second);
        AddDef(list, "218", "نشر الشائعات بين الطلاب", "سلوكية", ViolationDegree.Second);
        AddDef(list, "219", "تحريض الطلاب على مخالفة الأنظمة", "سلوكية", ViolationDegree.Second);
        AddDef(list, "220", "الخروج من المدرسة بدون إذن", "سلوكية", ViolationDegree.Second);

        // ═══════════════════════════════════════
        // الدرجة الثالثة - مخالفات كبيرة
        // ═══════════════════════════════════════
        AddDef(list, "301", "تكرار مخالفات الدرجة الثانية", "سلوكية", ViolationDegree.Third);
        AddDef(list, "302", "الاعتداء الجسدي على الطلاب", "سلوكية", ViolationDegree.Third);
        AddDef(list, "303", "التدخين أو حيازة السجائر", "سلوكية", ViolationDegree.Third);
        AddDef(list, "304", "السرقة من الطلاب أو المدرسة", "سلوكية", ViolationDegree.Third);
        AddDef(list, "305", "إتلاف الممتلكات المدرسية عمداً", "سلوكية", ViolationDegree.Third);
        AddDef(list, "306", "الغش في الاختبارات النهائية", "تعليمية", ViolationDegree.Third);
        AddDef(list, "307", "التحرش اللفظي", "سلوكية", ViolationDegree.Third);
        AddDef(list, "308", "التنمر الإلكتروني", "سلوكية", ViolationDegree.Third);
        AddDef(list, "309", "تهديد الطلاب أو الموظفين", "سلوكية", ViolationDegree.Third);
        AddDef(list, "310", "حيازة مواد خطرة (عدا الأسلحة)", "سلوكية", ViolationDegree.Third);
        AddDef(list, "311", "تصوير المعلمين أو الطلاب ونشرها", "سلوكية", ViolationDegree.Third);
        AddDef(list, "312", "الإساءة لسمعة المدرسة عبر وسائل التواصل", "سلوكية", ViolationDegree.Third);
        AddDef(list, "313", "رفض الانصياع لتعليمات إدارة المدرسة", "سلوكية", ViolationDegree.Third);
        AddDef(list, "314", "ممارسة الألعاب الخطرة في المدرسة", "سلوكية", ViolationDegree.Third);
        AddDef(list, "315", "الهروب المتكرر من المدرسة", "سلوكية", ViolationDegree.Third);
        AddDef(list, "316", "التعدي على ممتلكات خاصة بالمعلمين", "سلوكية", ViolationDegree.Third);
        AddDef(list, "317", "الاعتداء اللفظي الشديد على المعلم", "سلوكية", ViolationDegree.Third);
        AddDef(list, "318", "العنصرية أو التمييز ضد الطلاب", "سلوكية", ViolationDegree.Third);
        AddDef(list, "319", "ابتزاز الطلاب", "سلوكية", ViolationDegree.Third);
        AddDef(list, "320", "الغياب المتكرر بدون عذر (أكثر من 10 أيام)", "سلوكية", ViolationDegree.Third);

        // ═══════════════════════════════════════
        // الدرجة الرابعة - مخالفات جسيمة
        // ═══════════════════════════════════════
        AddDef(list, "401", "تكرار مخالفات الدرجة الثالثة", "سلوكية", ViolationDegree.Fourth);
        AddDef(list, "402", "الاعتداء الجسدي على المعلم أو الموظف", "سلوكية", ViolationDegree.Fourth);
        AddDef(list, "403", "حيازة أو تعاطي المخدرات", "سلوكية", ViolationDegree.Fourth);
        AddDef(list, "404", "حيازة الأسلحة البيضاء", "سلوكية", ViolationDegree.Fourth);
        AddDef(list, "405", "التحرش الجسدي", "سلوكية", ViolationDegree.Fourth);
        AddDef(list, "406", "الاعتداء الجسدي الخطير على طالب", "سلوكية", ViolationDegree.Fourth);
        AddDef(list, "407", "ترويج المخدرات أو المسكرات", "سلوكية", ViolationDegree.Fourth);
        AddDef(list, "408", "إشعال الحرائق عمداً", "سلوكية", ViolationDegree.Fourth);
        AddDef(list, "409", "التخريب الجسيم للممتلكات المدرسية", "سلوكية", ViolationDegree.Fourth);
        AddDef(list, "410", "التهديد باستخدام العنف الشديد", "سلوكية", ViolationDegree.Fourth);
        AddDef(list, "411", "نشر محتوى إباحي في المدرسة", "سلوكية", ViolationDegree.Fourth);
        AddDef(list, "412", "تنظيم أعمال شغب جماعية", "سلوكية", ViolationDegree.Fourth);
        AddDef(list, "413", "الابتزاز المالي أو الجسدي المتكرر", "سلوكية", ViolationDegree.Fourth);
        AddDef(list, "414", "سرقة اختبارات أو وثائق رسمية", "تعليمية", ViolationDegree.Fourth);
        AddDef(list, "415", "تعاطي المسكرات داخل المدرسة", "سلوكية", ViolationDegree.Fourth);

        // ═══════════════════════════════════════
        // الدرجة الخامسة - مخالفات بالغة الخطورة
        // ═══════════════════════════════════════
        AddDef(list, "501", "تكرار مخالفات الدرجة الرابعة", "سلوكية", ViolationDegree.Fifth);
        AddDef(list, "502", "حيازة أسلحة نارية", "سلوكية", ViolationDegree.Fifth);
        AddDef(list, "503", "الاعتداء الجسدي المسبب لإصابات خطيرة", "سلوكية", ViolationDegree.Fifth);
        AddDef(list, "504", "ارتكاب جرائم أخلاقية بالغة", "سلوكية", ViolationDegree.Fifth);
        AddDef(list, "505", "ترويج وتوزيع المخدرات داخل المدرسة", "سلوكية", ViolationDegree.Fifth);
        AddDef(list, "506", "تهديد حياة الآخرين", "سلوكية", ViolationDegree.Fifth);
        AddDef(list, "507", "التسبب في ضرر جسيم لمبنى المدرسة", "سلوكية", ViolationDegree.Fifth);
        AddDef(list, "508", "ارتكاب أعمال إجرامية داخل المدرسة", "سلوكية", ViolationDegree.Fifth);
        AddDef(list, "509", "الاعتداء الجنسي", "سلوكية", ViolationDegree.Fifth);
        AddDef(list, "510", "الإخلال الجسيم بالأمن المدرسي", "سلوكية", ViolationDegree.Fifth);

        return list;
    }

    private static void AddDef(List<ViolationTypeDef> list, string code, string desc, string category, ViolationDegree degree)
    {
        list.Add(new ViolationTypeDef
        {
            Code = code,
            Description = desc,
            Category = category,
            Degree = degree
        });
    }
}
