using Microsoft.EntityFrameworkCore;
using SchoolBehaviorSystem.Domain.Entities;

namespace SchoolBehaviorSystem.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // Core
    public DbSet<SchoolSettings> SchoolSettings => Set<SchoolSettings>();
    public DbSet<StageConfig> StageConfigs => Set<StageConfig>();
    public DbSet<GradeConfig> GradeConfigs => Set<GradeConfig>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Teacher> Teachers => Set<Teacher>();
    public DbSet<Committee> Committees => Set<Committee>();
    public DbSet<Subject> Subjects => Set<Subject>();

    // Students
    public DbSet<Student> Students => Set<Student>();

    // Records
    public DbSet<Violation> Violations => Set<Violation>();
    public DbSet<ViolationTypeDef> ViolationTypeDefs => Set<ViolationTypeDef>();
    public DbSet<TardinessRecord> TardinessRecords => Set<TardinessRecord>();
    public DbSet<PermissionRecord> PermissionRecords => Set<PermissionRecord>();
    public DbSet<DailyAbsence> DailyAbsences => Set<DailyAbsence>();
    public DbSet<CumulativeAbsence> CumulativeAbsences => Set<CumulativeAbsence>();
    public DbSet<EducationalNote> EducationalNotes => Set<EducationalNote>();
    public DbSet<PositiveBehavior> PositiveBehaviors => Set<PositiveBehavior>();
    public DbSet<CommunicationLog> CommunicationLogs => Set<CommunicationLog>();

    // Support
    public DbSet<NoteTypeDef> NoteTypeDefs => Set<NoteTypeDef>();
    public DbSet<ParentExcuse> ParentExcuses => Set<ParentExcuse>();
    public DbSet<ParentAccessCode> ParentAccessCodes => Set<ParentAccessCode>();
    public DbSet<WhatsAppSession> WhatsAppSessions => Set<WhatsAppSession>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<WhatsAppSettings> WhatsAppSettings => Set<WhatsAppSettings>();

    // Templates
    public DbSet<MessageTemplate> MessageTemplates => Set<MessageTemplate>();

    // Academic
    public DbSet<AcademicSummary> AcademicSummaries => Set<AcademicSummary>();
    public DbSet<AcademicGrade> AcademicGrades => Set<AcademicGrade>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // SchoolSettings - single row
        modelBuilder.Entity<SchoolSettings>(e =>
        {
            e.ToTable("school_settings");
            e.HasKey(x => x.Id);
        });

        // StageConfig
        modelBuilder.Entity<StageConfig>(e =>
        {
            e.ToTable("stage_configs");
            e.HasKey(x => x.Id);
            e.HasMany(x => x.Grades).WithOne(x => x.StageConfig).HasForeignKey(x => x.StageConfigId);
        });

        modelBuilder.Entity<GradeConfig>(e =>
        {
            e.ToTable("grade_configs");
            e.HasKey(x => x.Id);
        });

        // Users
        modelBuilder.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.TokenLink).IsUnique();
        });

        // Teachers
        modelBuilder.Entity<Teacher>(e =>
        {
            e.ToTable("teachers");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.CivilId).IsUnique();
        });

        // Students
        modelBuilder.Entity<Student>(e =>
        {
            e.ToTable("students");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.StudentNumber);
            e.HasIndex(x => new { x.Stage, x.Grade, x.Class });
        });

        // Violations
        modelBuilder.Entity<Violation>(e =>
        {
            e.ToTable("violations");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.Stage, x.HijriDate });
            e.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId);
        });

        modelBuilder.Entity<ViolationTypeDef>(e =>
        {
            e.ToTable("violation_type_defs");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.Code).IsUnique();
        });

        // Tardiness
        modelBuilder.Entity<TardinessRecord>(e =>
        {
            e.ToTable("tardiness_records");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.Stage, x.HijriDate });
            e.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId);
        });

        // Permissions
        modelBuilder.Entity<PermissionRecord>(e =>
        {
            e.ToTable("permission_records");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.Stage, x.HijriDate });
            e.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId);
        });

        // Daily Absence
        modelBuilder.Entity<DailyAbsence>(e =>
        {
            e.ToTable("daily_absences");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.Stage, x.HijriDate });
            e.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId);
        });

        // Cumulative Absence
        modelBuilder.Entity<CumulativeAbsence>(e =>
        {
            e.ToTable("cumulative_absences");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.StudentId, x.Stage }).IsUnique();
            e.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId);
        });

        // Educational Notes
        modelBuilder.Entity<EducationalNote>(e =>
        {
            e.ToTable("educational_notes");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.Stage, x.HijriDate });
            e.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId);
        });

        // Positive Behavior
        modelBuilder.Entity<PositiveBehavior>(e =>
        {
            e.ToTable("positive_behaviors");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.Stage, x.HijriDate });
            e.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId);
            e.HasOne(x => x.LinkedViolation).WithMany().HasForeignKey(x => x.LinkedViolationId).OnDelete(DeleteBehavior.SetNull);
        });

        // Communication Log
        modelBuilder.Entity<CommunicationLog>(e =>
        {
            e.ToTable("communication_logs");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.Stage, x.MiladiDate });
            e.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId);
        });

        // Support tables
        modelBuilder.Entity<Committee>(e => { e.ToTable("committees"); });
        modelBuilder.Entity<Subject>(e => { e.ToTable("subjects"); });
        modelBuilder.Entity<NoteTypeDef>(e => { e.ToTable("note_type_defs"); });
        modelBuilder.Entity<ParentExcuse>(e =>
        {
            e.ToTable("parent_excuses");
            e.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId);
        });
        modelBuilder.Entity<ParentAccessCode>(e =>
        {
            e.ToTable("parent_access_codes");
            e.HasIndex(x => x.Code).IsUnique();
        });
        modelBuilder.Entity<WhatsAppSession>(e => { e.ToTable("whatsapp_sessions"); });
        modelBuilder.Entity<AuditLog>(e => { e.ToTable("audit_logs"); });
        modelBuilder.Entity<WhatsAppSettings>(e => { e.ToTable("whatsapp_settings"); });
        modelBuilder.Entity<MessageTemplate>(e =>
        {
            e.ToTable("message_templates");
            e.HasIndex(x => x.Type).IsUnique();
        });
    }
}
