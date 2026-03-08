using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SchoolBehaviorSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStaffFieldsToSchoolSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CommitteeName",
                table: "school_settings",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "CounselorName",
                table: "school_settings",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "DeputyName",
                table: "school_settings",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "Letterhead",
                table: "school_settings",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "ManagerName",
                table: "school_settings",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "WakeelName",
                table: "school_settings",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "WakeelSignature",
                table: "school_settings",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CommitteeName",
                table: "school_settings");

            migrationBuilder.DropColumn(
                name: "CounselorName",
                table: "school_settings");

            migrationBuilder.DropColumn(
                name: "DeputyName",
                table: "school_settings");

            migrationBuilder.DropColumn(
                name: "Letterhead",
                table: "school_settings");

            migrationBuilder.DropColumn(
                name: "ManagerName",
                table: "school_settings");

            migrationBuilder.DropColumn(
                name: "WakeelName",
                table: "school_settings");

            migrationBuilder.DropColumn(
                name: "WakeelSignature",
                table: "school_settings");
        }
    }
}
