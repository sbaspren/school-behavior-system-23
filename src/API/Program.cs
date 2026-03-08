using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SchoolBehaviorSystem.Application.Interfaces;
using SchoolBehaviorSystem.Infrastructure.Services;
using SchoolBehaviorSystem.Infrastructure.ExternalServices;
using SchoolBehaviorSystem.Infrastructure.Data;

var builder = WebApplication.CreateBuilder(args);

// Database - MariaDB
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Server=localhost;Port=3306;Database=school_behavior;User=root;Password=;";

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString,
        ServerVersion.Create(10, 6, 0, Pomelo.EntityFrameworkCore.MySql.Infrastructure.ServerType.MariaDb)));

// Cache
builder.Services.AddMemoryCache();

// Services
builder.Services.AddScoped<ISchoolConfigService, SchoolConfigService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddSingleton<IHijriDateService, HijriDateService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddHttpClient<IWhatsAppServerService, WhatsAppServerService>();
builder.Services.AddHttpClient<ISmsService, SmsService>();

// Background Services — مطابق لـ setupDailyBakeTrigger() في Server_TeacherInput.gs سطر 185-203
builder.Services.AddHostedService<TeacherDataBakeService>();
// ★ ترحيل الغياب اليومي — مطابق لـ archiveDailyAbsence() + createArchiveTrigger() في Server_Absence_Daily.gs
builder.Services.AddHostedService<AbsenceArchiveService>();

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? "SchoolBehaviorSystemDefaultKey2024!@#$%";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "SchoolBehaviorSystem",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "SchoolBehaviorSystem",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

// Controllers
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS - for React dev server
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReact", policy =>
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

// Auto-migrate database + seed data
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    await DataSeeder.SeedAsync(db);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowReact");
app.UseAuthentication();
app.UseAuthorization();

// Serve React build (wwwroot)
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();

// SPA fallback: any non-API route → index.html
app.MapFallbackToFile("index.html");

app.Run();
