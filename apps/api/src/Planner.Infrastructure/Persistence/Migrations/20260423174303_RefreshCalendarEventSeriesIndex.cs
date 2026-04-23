using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Planner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RefreshCalendarEventSeriesIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_calendar_events_SeriesId_StartAtUtc",
                schema: "planner",
                table: "calendar_events");

            migrationBuilder.CreateIndex(
                name: "IX_calendar_events_SeriesId_StartAtUtc",
                schema: "planner",
                table: "calendar_events",
                columns: new[] { "SeriesId", "StartAtUtc" },
                unique: true,
                filter: "\"SeriesId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_calendar_events_SeriesId_StartAtUtc",
                schema: "planner",
                table: "calendar_events");

            migrationBuilder.CreateIndex(
                name: "IX_calendar_events_SeriesId_StartAtUtc",
                schema: "planner",
                table: "calendar_events",
                columns: new[] { "SeriesId", "StartAtUtc" },
                unique: true,
                filter: "series_id IS NOT NULL");
        }
    }
}
