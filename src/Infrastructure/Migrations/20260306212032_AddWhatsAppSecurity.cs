using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SchoolBehaviorSystem.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddWhatsAppSecurity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "RecoveryCodeExpiry",
                table: "whatsapp_settings",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecoveryPhone1",
                table: "whatsapp_settings",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "RecoveryPhone2",
                table: "whatsapp_settings",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "SecurityCode",
                table: "whatsapp_settings",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "TempRecoveryCode",
                table: "whatsapp_settings",
                type: "longtext",
                nullable: false)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RecoveryCodeExpiry",
                table: "whatsapp_settings");

            migrationBuilder.DropColumn(
                name: "RecoveryPhone1",
                table: "whatsapp_settings");

            migrationBuilder.DropColumn(
                name: "RecoveryPhone2",
                table: "whatsapp_settings");

            migrationBuilder.DropColumn(
                name: "SecurityCode",
                table: "whatsapp_settings");

            migrationBuilder.DropColumn(
                name: "TempRecoveryCode",
                table: "whatsapp_settings");
        }
    }
}
