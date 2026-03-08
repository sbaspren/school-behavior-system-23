using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SchoolBehaviorSystem.Infrastructure.Data;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        // Connection string for design-time only (migrations)
        optionsBuilder.UseMySql(
            "Server=localhost;Port=3306;Database=school_behavior;User=root;Password=;",
            ServerVersion.Create(10, 6, 0, Pomelo.EntityFrameworkCore.MySql.Infrastructure.ServerType.MariaDb));

        return new AppDbContext(optionsBuilder.Options);
    }
}
