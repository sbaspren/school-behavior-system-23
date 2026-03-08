using Microsoft.AspNetCore.Mvc;
using SchoolBehaviorSystem.Application.DTOs.Responses;
using SchoolBehaviorSystem.Application.Interfaces;

namespace SchoolBehaviorSystem.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    public async Task<ActionResult<ApiResponse<object>>> Login([FromBody] LoginRequest request)
    {
        var result = await _authService.LoginAsync(request.Mobile, request.Password);
        if (!result.Success)
            return Ok(ApiResponse<object>.Fail(result.Error!));

        return Ok(ApiResponse<object>.Ok(new
        {
            token = result.Token,
            user = new
            {
                id = result.User!.Id,
                name = result.User.Name,
                role = result.User.Role.ToString(),
                mobile = result.User.Mobile,
                scopeType = result.User.ScopeType,
                scopeValue = result.User.ScopeValue
            }
        }));
    }

    [HttpGet("token/{token}")]
    public async Task<ActionResult<ApiResponse<object>>> ValidateToken(string token)
    {
        var result = await _authService.ValidateTokenLinkAsync(token);
        if (!result.Success)
            return Ok(ApiResponse<object>.Fail(result.Error!));

        return Ok(ApiResponse<object>.Ok(new
        {
            token = result.Token,
            user = new
            {
                id = result.User!.Id,
                name = result.User.Name,
                role = result.User.Role.ToString(),
                mobile = result.User.Mobile
            }
        }));
    }
}

public class LoginRequest
{
    public string Mobile { get; set; } = "";
    public string Password { get; set; } = "";
}
