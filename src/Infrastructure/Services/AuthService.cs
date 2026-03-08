using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using SchoolBehaviorSystem.Application.Interfaces;
using SchoolBehaviorSystem.Domain.Entities;
using SchoolBehaviorSystem.Infrastructure.Data;

namespace SchoolBehaviorSystem.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AuthService(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public async Task<AuthResult> LoginAsync(string mobile, string password)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Mobile == mobile && u.IsActive);
        if (user == null)
            return AuthResult.Fail("رقم الجوال غير مسجل");

        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            return AuthResult.Fail("كلمة المرور غير صحيحة");

        var token = GenerateJwtToken(user);
        return AuthResult.Ok(token, user);
    }

    public async Task<AuthResult> ValidateTokenLinkAsync(string token)
    {
        // البحث في المستخدمين
        var user = await _db.Users.FirstOrDefaultAsync(u => u.TokenLink == token && u.IsActive);
        if (user != null)
        {
            var jwt = GenerateJwtToken(user);
            return AuthResult.Ok(jwt, user);
        }

        // البحث في المعلمين
        var teacher = await _db.Teachers.FirstOrDefaultAsync(t => t.TokenLink == token && t.IsActive);
        if (teacher != null)
        {
            // إنشاء user وهمي من بيانات المعلم
            var teacherUser = new User
            {
                Id = -teacher.Id,
                Name = teacher.Name,
                Role = Domain.Enums.UserRole.Teacher,
                Mobile = teacher.Mobile,
                TokenLink = teacher.TokenLink
            };
            var jwt = GenerateJwtToken(teacherUser);
            return AuthResult.Ok(jwt, teacherUser);
        }

        return AuthResult.Fail("رابط غير صالح أو منتهي الصلاحية");
    }

    public string GenerateJwtToken(User user)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_config["Jwt:Key"] ?? "SchoolBehaviorSystemDefaultKey2024!@#$%"));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("mobile", user.Mobile),
            new Claim("scope_type", user.ScopeType),
            new Claim("scope_value", user.ScopeValue)
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? "SchoolBehaviorSystem",
            audience: _config["Jwt:Audience"] ?? "SchoolBehaviorSystem",
            claims: claims,
            expires: DateTime.UtcNow.AddHours(12),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerateTokenLink()
    {
        return Guid.NewGuid().ToString("N")[..16];
    }
}
