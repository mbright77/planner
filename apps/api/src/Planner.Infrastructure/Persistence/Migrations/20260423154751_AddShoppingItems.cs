using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Planner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddShoppingItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "shopping_items",
                schema: "planner",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FamilyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Label = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    IsCompleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CompletedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AddedByProfileId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shopping_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_shopping_items_families_FamilyId",
                        column: x => x.FamilyId,
                        principalSchema: "planner",
                        principalTable: "families",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_shopping_items_profiles_AddedByProfileId",
                        column: x => x.AddedByProfileId,
                        principalSchema: "planner",
                        principalTable: "profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_shopping_items_AddedByProfileId",
                schema: "planner",
                table: "shopping_items",
                column: "AddedByProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_shopping_items_FamilyId_IsCompleted_Category",
                schema: "planner",
                table: "shopping_items",
                columns: new[] { "FamilyId", "IsCompleted", "Category" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "shopping_items",
                schema: "planner");
        }
    }
}
