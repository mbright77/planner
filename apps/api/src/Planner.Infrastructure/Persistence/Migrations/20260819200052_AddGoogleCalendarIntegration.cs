using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Planner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGoogleCalendarIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "google_calendar_connections",
                schema: "planner",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    FamilyId = table.Column<Guid>(type: "uuid", nullable: false),
                    GoogleAccountEmail = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    GoogleAccountSubject = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    RefreshTokenCipher = table.Column<byte[]>(type: "bytea", nullable: false),
                    RefreshTokenNonce = table.Column<byte[]>(type: "bytea", nullable: false),
                    RefreshTokenTag = table.Column<byte[]>(type: "bytea", nullable: false),
                    KeyVersion = table.Column<int>(type: "integer", nullable: false),
                    GrantedScopes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ConnectedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LastSyncAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastErrorAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LastError = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CalendarsSyncedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_google_calendar_connections", x => x.Id);
                    table.ForeignKey(
                        name: "FK_google_calendar_connections_families_FamilyId",
                        column: x => x.FamilyId,
                        principalSchema: "planner",
                        principalTable: "families",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "google_oauth_states",
                schema: "planner",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    StateHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CodeVerifier = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ExpiresAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ConsumedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_google_oauth_states", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "user_calendar_preferences",
                schema: "planner",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    FamilyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Sources = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_calendar_preferences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_user_calendar_preferences_families_FamilyId",
                        column: x => x.FamilyId,
                        principalSchema: "planner",
                        principalTable: "families",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "google_calendar_subscriptions",
                schema: "planner",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ConnectionId = table.Column<Guid>(type: "uuid", nullable: false),
                    GoogleCalendarId = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    Summary = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    ColorHex = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    TimeZone = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    AccessRole = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    IsPrimary = table.Column<bool>(type: "boolean", nullable: false),
                    IsSelected = table.Column<bool>(type: "boolean", nullable: false),
                    LastSeenAtUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_google_calendar_subscriptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_google_calendar_subscriptions_google_calendar_connections_C~",
                        column: x => x.ConnectionId,
                        principalSchema: "planner",
                        principalTable: "google_calendar_connections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_google_calendar_connections_FamilyId",
                schema: "planner",
                table: "google_calendar_connections",
                column: "FamilyId");

            migrationBuilder.CreateIndex(
                name: "IX_google_calendar_connections_UserId",
                schema: "planner",
                table: "google_calendar_connections",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_google_calendar_subscriptions_ConnectionId_GoogleCalendarId",
                schema: "planner",
                table: "google_calendar_subscriptions",
                columns: new[] { "ConnectionId", "GoogleCalendarId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_google_oauth_states_StateHash",
                schema: "planner",
                table: "google_oauth_states",
                column: "StateHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_user_calendar_preferences_FamilyId",
                schema: "planner",
                table: "user_calendar_preferences",
                column: "FamilyId");

            migrationBuilder.CreateIndex(
                name: "IX_user_calendar_preferences_UserId",
                schema: "planner",
                table: "user_calendar_preferences",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "google_calendar_subscriptions",
                schema: "planner");

            migrationBuilder.DropTable(
                name: "google_oauth_states",
                schema: "planner");

            migrationBuilder.DropTable(
                name: "user_calendar_preferences",
                schema: "planner");

            migrationBuilder.DropTable(
                name: "google_calendar_connections",
                schema: "planner");
        }
    }
}
