using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Planner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class LinkInvitesToExistingProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LinkedUserId",
                schema: "planner",
                table: "profiles",
                type: "character varying(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ProfileId",
                schema: "planner",
                table: "family_invites",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_profiles_LinkedUserId",
                schema: "planner",
                table: "profiles",
                column: "LinkedUserId",
                unique: true,
                filter: "\"linked_user_id\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_family_invites_ProfileId",
                schema: "planner",
                table: "family_invites",
                column: "ProfileId");

            migrationBuilder.AddForeignKey(
                name: "FK_family_invites_profiles_ProfileId",
                schema: "planner",
                table: "family_invites",
                column: "ProfileId",
                principalSchema: "planner",
                principalTable: "profiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_family_invites_profiles_ProfileId",
                schema: "planner",
                table: "family_invites");

            migrationBuilder.DropIndex(
                name: "IX_profiles_LinkedUserId",
                schema: "planner",
                table: "profiles");

            migrationBuilder.DropIndex(
                name: "IX_family_invites_ProfileId",
                schema: "planner",
                table: "family_invites");

            migrationBuilder.DropColumn(
                name: "LinkedUserId",
                schema: "planner",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "ProfileId",
                schema: "planner",
                table: "family_invites");
        }
    }
}
