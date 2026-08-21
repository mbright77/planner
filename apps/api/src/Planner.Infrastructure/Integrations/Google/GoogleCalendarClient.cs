using System.Globalization;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace Planner.Infrastructure.Integrations.Google;

public sealed class GoogleCalendarClient(HttpClient httpClient) : IGoogleCalendarClient
{
    private const string CalendarListEndpoint = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
    private const string EventsEndpointTemplate = "https://www.googleapis.com/calendar/v3/calendars/{0}/events";

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

    public async Task<IReadOnlyList<GoogleCalendarEventEntry>> ListEventsAsync(
        string accessToken,
        string calendarId,
        DateTimeOffset timeMinUtc,
        DateTimeOffset timeMaxUtc,
        string timeZoneId,
        CancellationToken cancellationToken)
    {
        var entries = new List<GoogleCalendarEventEntry>();
        var baseUrl = string.Format(CultureInfo.InvariantCulture, EventsEndpointTemplate, Uri.EscapeDataString(calendarId));
        string? pageToken = null;

        do
        {
            var query = new Dictionary<string, string>
            {
                ["singleEvents"] = "true",
                ["orderBy"] = "startTime",
                ["timeMin"] = FormatRfc3339(timeMinUtc),
                ["timeMax"] = FormatRfc3339(timeMaxUtc),
                ["timeZone"] = timeZoneId,
                ["maxResults"] = "250",
            };
            if (pageToken is not null)
            {
                query["pageToken"] = pageToken;
            }

            var queryString = string.Join(
                "&", query.Select(kvp => $"{Uri.EscapeDataString(kvp.Key)}={Uri.EscapeDataString(kvp.Value)}"));

            using var request = new HttpRequestMessage(HttpMethod.Get, $"{baseUrl}?{queryString}");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            using var response = await httpClient.SendAsync(request, cancellationToken);
            response.EnsureSuccessStatusCode();

            var payload = await response.Content.ReadFromJsonAsync<EventsListPayload>(cancellationToken)
                ?? throw new InvalidOperationException("Google events endpoint returned an empty response.");

            foreach (var item in payload.Items ?? [])
            {
                if (string.IsNullOrEmpty(item.Id))
                {
                    continue;
                }

                entries.Add(MapEntry(item));
            }

            pageToken = payload.NextPageToken;
        }
        while (!string.IsNullOrEmpty(pageToken));

        return entries;
    }

    private static GoogleCalendarEventEntry MapEntry(EventItemPayload item)
    {
        var isAllDay = item.Start?.Date is not null;
        var declinedBySelf = item.Attendees?.Any(x =>
            x.Self == true && string.Equals(x.ResponseStatus, "declined", StringComparison.OrdinalIgnoreCase)) ?? false;

        return new GoogleCalendarEventEntry(
            item.Id!,
            item.Status ?? "confirmed",
            item.Summary ?? string.Empty,
            item.Description,
            isAllDay,
            isAllDay && item.Start?.Date is not null ? DateOnly.Parse(item.Start.Date, CultureInfo.InvariantCulture) : null,
            isAllDay && item.End?.Date is not null ? DateOnly.Parse(item.End.Date, CultureInfo.InvariantCulture) : null,
            isAllDay ? null : item.Start?.DateTime,
            isAllDay ? null : item.End?.DateTime,
            declinedBySelf);
    }

    private static string FormatRfc3339(DateTimeOffset value) =>
        value.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture);

    private sealed record EventsListPayload(
        [property: JsonPropertyName("items")] List<EventItemPayload>? Items,
        [property: JsonPropertyName("nextPageToken")] string? NextPageToken);

    private sealed record EventItemPayload(
        [property: JsonPropertyName("id")] string? Id,
        [property: JsonPropertyName("status")] string? Status,
        [property: JsonPropertyName("summary")] string? Summary,
        [property: JsonPropertyName("description")] string? Description,
        [property: JsonPropertyName("start")] EventDateTimePayload? Start,
        [property: JsonPropertyName("end")] EventDateTimePayload? End,
        [property: JsonPropertyName("attendees")] List<EventAttendeePayload>? Attendees);

    private sealed record EventDateTimePayload(
        [property: JsonPropertyName("date")] string? Date,
        [property: JsonPropertyName("dateTime")] DateTimeOffset? DateTime);

    private sealed record EventAttendeePayload(
        [property: JsonPropertyName("self")] bool? Self,
        [property: JsonPropertyName("responseStatus")] string? ResponseStatus);
}
