using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SchoolBehaviorSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageTemplateAndCompensationLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LinkedViolationId",
                table: "positive_behaviors",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "message_templates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    Type = table.Column<string>(type: "varchar(255)", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Content = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_message_templates", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_positive_behaviors_LinkedViolationId",
                table: "positive_behaviors",
                column: "LinkedViolationId");

            migrationBuilder.CreateIndex(
                name: "IX_message_templates_Type",
                table: "message_templates",
                column: "Type",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_positive_behaviors_violations_LinkedViolationId",
                table: "positive_behaviors",
                column: "LinkedViolationId",
                principalTable: "violations",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_positive_behaviors_violations_LinkedViolationId",
                table: "positive_behaviors");

            migrationBuilder.DropTable(
                name: "message_templates");

            migrationBuilder.DropIndex(
                name: "IX_positive_behaviors_LinkedViolationId",
                table: "positive_behaviors");

            migrationBuilder.DropColumn(
                name: "LinkedViolationId",
                table: "positive_behaviors");
        }
    }
}
