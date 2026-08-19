namespace Planner.Api.Endpoints;

internal static class FamilyScheduleHelpers
{
    public static DateOnly GetWeekStart(DateOnly date)
    {
        var diff = date.DayOfWeek switch
        {
            DayOfWeek.Sunday => -6,
            _ => DayOfWeek.Monday - date.DayOfWeek,
        };

        return date.AddDays(diff);
    }

    public static TimeZoneInfo ResolveTimeZone(string timeZoneId)
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.Utc;
        }
        catch (InvalidTimeZoneException)
        {
            return TimeZoneInfo.Utc;
        }
    }
}
