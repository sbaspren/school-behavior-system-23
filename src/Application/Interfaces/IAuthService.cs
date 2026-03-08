using SchoolBehaviorSystem.Domain.Entities;

namespace SchoolBehaviorSystem.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResult> LoginAsync(string mobile, string password);
    Task<AuthResult> ValidateTokenLinkAsync(string token);
    string GenerateJwtToken(User user);
    string GenerateTokenLink();
}

public class AuthResult
{
    public bool Success { get; set; }
    public string? Token { get; set; }
    public User? User { get; set; }
    public string? Error { get; set; }

    public static AuthResult Ok(string token, User user) => new() { Success = true, Token = token, User = user };
    public static AuthResult Fail(string error) => new() { Success = false, Error = error };
}
