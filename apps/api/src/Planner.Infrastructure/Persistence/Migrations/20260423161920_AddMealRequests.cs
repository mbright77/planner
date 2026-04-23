using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Planner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMealRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "meal_requests",
                schema: "planner",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FamilyId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequesterProfileId = table.Column<Guid>(type: "uuid", nullable: true),
                    RequestedForDate = table.Column<DateOnly>(type: "date", nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    AssigneeProfileId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meal_requests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_meal_requests_families_FamilyId",
                        column: x => x.FamilyId,
                        principalSchema: "planner",
                        principalTable: "families",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_meal_requests_profiles_AssigneeProfileId",
                        column: x => x.AssigneeProfileId,
                        principalSchema: "planner",
                        principalTable: "profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_meal_requests_profiles_RequesterProfileId",
                        column: x => x.RequesterProfileId,
                        principalSchema: "planner",
                        principalTable: "profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_meal_requests_AssigneeProfileId",
                schema: "planner",
                table: "meal_requests",
                column: "AssigneeProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_meal_requests_FamilyId_Status_CreatedAtUtc",
                schema: "planner",
                table: "meal_requests",
                columns: new[] { "FamilyId", "Status", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_meal_requests_RequesterProfileId",
                schema: "planner",
                table: "meal_requests",
                column: "RequesterProfileId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "meal_requests",
                schema: "planner");
        }
    }
}
