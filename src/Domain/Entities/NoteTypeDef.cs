using SchoolBehaviorSystem.Domain.Enums;

namespace SchoolBehaviorSystem.Domain.Entities;

public class NoteTypeDef
{
    public int Id { get; set; }
    public Stage Stage { get; set; }
    public string NoteType { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
