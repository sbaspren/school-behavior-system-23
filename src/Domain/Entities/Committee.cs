namespace SchoolBehaviorSystem.Domain.Entities;

public class Committee
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Members { get; set; } = "";            // comma-separated
    public bool IsActive { get; set; } = true;
}
