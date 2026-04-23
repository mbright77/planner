using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Planner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddFamilyInvites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "family_invites",
                schema: "planner",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FamilyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    Token = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    ExpiresAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AcceptedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AcceptedByUserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_family_invites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_family_invites_families_FamilyId",
                        column: x => x.FamilyId,
                        principalSchema: "planner",
                        principalTable: "families",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_family_invites_FamilyId_Email_AcceptedAtUtc",
                schema: "planner",
                table: "family_invites",
                columns: new[] { "FamilyId", "Email", "AcceptedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_family_invites_Token",
                schema: "planner",
                table: "family_invites",
                column: "Token",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "family_invites",
                schema: "planner");
        }
    }
}
