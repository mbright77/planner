using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Planner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TuneShoppingItemOrderingIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_shopping_items_FamilyId_IsCompleted_Category",
                schema: "planner",
                table: "shopping_items");

            migrationBuilder.CreateIndex(
                name: "IX_shopping_items_FamilyId_IsCompleted_Category_Label",
                schema: "planner",
                table: "shopping_items",
                columns: new[] { "FamilyId", "IsCompleted", "Category", "Label" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_shopping_items_FamilyId_IsCompleted_Category_Label",
                schema: "planner",
                table: "shopping_items");

            migrationBuilder.CreateIndex(
                name: "IX_shopping_items_FamilyId_IsCompleted_Category",
                schema: "planner",
                table: "shopping_items",
                columns: new[] { "FamilyId", "IsCompleted", "Category" });
        }
    }
}
