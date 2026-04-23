using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Planner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCalendarEventSeries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SeriesId",
                schema: "planner",
                table: "calendar_events",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "calendar_event_series",
                schema: "planner",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FamilyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    StartsAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EndsAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    RepeatUntil = table.Column<DateOnly>(type: "date", nullable: false),
                    MaterializedThrough = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    AssignedProfileId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_calendar_event_series", x => x.Id);
                    table.ForeignKey(
                        name: "FK_calendar_event_series_families_FamilyId",
                        column: x => x.FamilyId,
                        principalSchema: "planner",
                        principalTable: "families",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_calendar_event_series_profiles_AssignedProfileId",
                        column: x => x.AssignedProfileId,
                        principalSchema: "planner",
                        principalTable: "profiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_calendar_events_SeriesId_StartAtUtc",
                schema: "planner",
                table: "calendar_events",
                columns: new[] { "SeriesId", "StartAtUtc" },
                unique: true,
                filter: "series_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_calendar_event_series_AssignedProfileId",
                schema: "planner",
                table: "calendar_event_series",
                column: "AssignedProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_calendar_event_series_FamilyId_RepeatUntil",
                schema: "planner",
                table: "calendar_event_series",
                columns: new[] { "FamilyId", "RepeatUntil" });

            migrationBuilder.AddForeignKey(
                name: "FK_calendar_events_calendar_event_series_SeriesId",
                schema: "planner",
                table: "calendar_events",
                column: "SeriesId",
                principalSchema: "planner",
                principalTable: "calendar_event_series",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_calendar_events_calendar_event_series_SeriesId",
                schema: "planner",
                table: "calendar_events");

            migrationBuilder.DropTable(
                name: "calendar_event_series",
                schema: "planner");

            migrationBuilder.DropIndex(
                name: "IX_calendar_events_SeriesId_StartAtUtc",
                schema: "planner",
                table: "calendar_events");

            migrationBuilder.DropColumn(
                name: "SeriesId",
                schema: "planner",
                table: "calendar_events");
        }
    }
}
