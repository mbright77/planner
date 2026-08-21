using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace Planner.Infrastructure.Integrations.Google;

public sealed class GoogleCalendarClient(HttpClient httpClient) : IGoogleCalendarClient
{
    private const string CalendarListEndpoint = "https://www.googleapis.com/calendar/v3/users/me/calendarList";

    public async Task<IReadOnlyList<GoogleCalendarListEntry>> ListCalendarsAsync(string accessToken, CancellationToken cancellationToken)
    {
        var entries = new List<GoogleCalendarListEntry>();
        string? pageToken = null;

        do
        {
            var url = pageToken is null
                ? CalendarListEndpoint
                : $"{CalendarListEndpoint}?pageToken={Uri.EscapeDataString(pageToken)}";

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            using var response = await httpClient.SendAsync(request, cancellationToken);
            response.EnsureSuccessStatusCode();

            var payload = await response.Content.ReadFromJsonAsync<CalendarListPayload>(cancellationToken)
                ?? throw new InvalidOperationException("Google calendarList endpoint returned an empty response.");

            foreach (var item in payload.Items ?? [])
            {
                if (string.IsNullOrEmpty(item.Id))
                {
                    continue;
                }

                entries.Add(new GoogleCalendarListEntry(
                    item.Id,
                    item.Summary ?? item.Id,
                    item.Description,
                    item.BackgroundColor,
                    item.TimeZone,
                    item.AccessRole ?? "reader",
                    item.Primary ?? false));
            }

            pageToken = payload.NextPageToken;
        }
        while (!string.IsNullOrEmpty(pageToken));

        return entries;
    }

    private sealed record CalendarListPayload(
        [property: JsonPropertyName("items")] List<CalendarListItemPayload>? Items,
        [property: JsonPropertyName("nextPageToken")] string? NextPageToken);

    private sealed record CalendarListItemPayload(
        [property: JsonPropertyName("id")] string? Id,
        [property: JsonPropertyName("summary")] string? Summary,
        [property: JsonPropertyName("description")] string? Description,
        [property: JsonPropertyName("backgroundColor")] string? BackgroundColor,
        [property: JsonPropertyName("timeZone")] string? TimeZone,
        [property: JsonPropertyName("accessRole")] string? AccessRole,
        [property: JsonPropertyName("primary")] bool? Primary);
}
