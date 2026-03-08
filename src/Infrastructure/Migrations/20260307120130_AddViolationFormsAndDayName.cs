using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SchoolBehaviorSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddViolationFormsAndDayName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DayName",
                table: "violations",
                type: "longtext",
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Forms",
                table: "violations",
                type: "longtext",
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<int>(
                name: "DegreeForPrimary",
                table: "violation_type_defs",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DayName",
                table: "violations");

            migrationBuilder.DropColumn(
                name: "Forms",
                table: "violations");

            migrationBuilder.DropColumn(
                name: "DegreeForPrimary",
                table: "violation_type_defs");
        }
    }
}
