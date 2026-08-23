namespace Planner.Domain;

public interface IAssemblyMarker;

public enum FamilyRole
{
    Admin = 1,
    Member = 2,
}

public enum MealRequestStatus
{
    Pending = 1,
    Accepted = 2,
}

public enum CalendarSourceSelection
{
    Local = 1,
    Google = 2,
    Both = 3,
}

public enum GoogleConnectionStatus
{
    Connected = 1,
    NeedsReauth = 2,
}

public sealed class Family
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Timezone { get; set; } = "UTC";

    public DateTimeOffset CreatedAtUtc { get; set; }

    public ICollection<Profile> Profiles { get; set; } = new List<Profile>();

    public ICollection<FamilyMembership> Memberships { get; set; } = new List<FamilyMembership>();

    public ICollection<FamilyInvite> Invites { get; set; } = new List<FamilyInvite>();

    public ICollection<ShoppingItem> ShoppingItems { get; set; } = new List<ShoppingItem>();

    public ICollection<CalendarEvent> CalendarEvents { get; set; } = new List<CalendarEvent>();

    public ICollection<CalendarEventSeries> CalendarEventSeries { get; set; } = new List<CalendarEventSeries>();

    public ICollection<MealPlan> MealPlans { get; set; } = new List<MealPlan>();

    public ICollection<MealRequest> MealRequests { get; set; } = new List<MealRequest>();

    public ICollection<UserCalendarPreference> UserCalendarPreferences { get; set; } = new List<UserCalendarPreference>();

    public ICollection<GoogleCalendarConnection> GoogleCalendarConnections { get; set; } = new List<GoogleCalendarConnection>();
}

public sealed class Profile
{
    public Guid Id { get; set; }

    public Guid FamilyId { get; set; }

    public string? LinkedUserId { get; set; }

    public string DisplayName { get; set; } = string.Empty;

    public string ColorKey { get; set; } = string.Empty;

    public string? PreferredLanguage { get; set; }

    public bool IsActive { get; set; } = true;

    public Family Family { get; set; } = null!;

    public ICollection<CalendarEvent> CalendarEvents { get; set; } = new List<CalendarEvent>();

    public ICollection<MealPlan> MealPlans { get; set; } = new List<MealPlan>();

    public ICollection<FamilyInvite> FamilyInvites { get; set; } = new List<FamilyInvite>();
}

public sealed class FamilyMembership
{
    public Guid Id { get; set; }

    public Guid FamilyId { get; set; }

    public string UserId { get; set; } = string.Empty;

    public FamilyRole Role { get; set; } = FamilyRole.Member;

    public DateTimeOffset CreatedAtUtc { get; set; }

    public Family Family { get; set; } = null!;
}

public sealed class FamilyInvite
{
    public Guid Id { get; set; }

    public Guid FamilyId { get; set; }

    public Guid? ProfileId { get; set; }

    public string Email { get; set; } = string.Empty;

    public string Token { get; set; } = string.Empty;

    public DateTimeOffset ExpiresAtUtc { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? AcceptedAtUtc { get; set; }

    public string? AcceptedByUserId { get; set; }

    public Family Family { get; set; } = null!;

    public Profile? Profile { get; set; }
}

public sealed class ShoppingItem
{
    public Guid Id { get; set; }

    public Guid FamilyId { get; set; }

    public string Label { get; set; } = string.Empty;

    public string Category { get; set; } = string.Empty;

    public bool IsCompleted { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? CompletedAtUtc { get; set; }

    public Guid? AddedByProfileId { get; set; }

    public Family Family { get; set; } = null!;

    public Profile? AddedByProfile { get; set; }
}

public sealed class CalendarEvent
{
    public Guid Id { get; set; }

    public Guid FamilyId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Notes { get; set; }

    public DateTimeOffset StartAtUtc { get; set; }

    public DateTimeOffset EndAtUtc { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public Guid? AssignedProfileId { get; set; }

    public Guid? SeriesId { get; set; }

    public Family Family { get; set; } = null!;

    public Profile? AssignedProfile { get; set; }

    public CalendarEventSeries? Series { get; set; }
}

public sealed class CalendarEventSeries
{
    public Guid Id { get; set; }

    public Guid FamilyId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Notes { get; set; }

    public DateTimeOffset StartsAtUtc { get; set; }

    public DateTimeOffset EndsAtUtc { get; set; }

    public DateOnly RepeatUntil { get; set; }

    public DateOnly MaterializedThrough { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public Guid? AssignedProfileId { get; set; }

    public Family Family { get; set; } = null!;

    public Profile? AssignedProfile { get; set; }

    public ICollection<CalendarEvent> Events { get; set; } = new List<CalendarEvent>();
}

public sealed class MealPlan
{
    public Guid Id { get; set; }

    public Guid FamilyId { get; set; }

    public DateOnly MealDate { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Notes { get; set; }

    public string? RecipeUrl { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public Guid? OwnerProfileId { get; set; }

    public Family Family { get; set; } = null!;

    public Profile? OwnerProfile { get; set; }
}

public sealed class MealRequest
{
    public Guid Id { get; set; }

    public Guid FamilyId { get; set; }

    public Guid? RequesterProfileId { get; set; }

    public DateOnly? RequestedForDate { get; set; }

    public string Title { get; set; } = string.Empty;

    public string? Notes { get; set; }

    public MealRequestStatus Status { get; set; } = MealRequestStatus.Pending;

    public Guid? AssigneeProfileId { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public Family Family { get; set; } = null!;

    public Profile? RequesterProfile { get; set; }

    public Profile? AssigneeProfile { get; set; }
}

public sealed class UserCalendarPreference
{
    public Guid Id { get; set; }

    public string UserId { get; set; } = string.Empty;

    public Guid FamilyId { get; set; }

    public CalendarSourceSelection Sources { get; set; } = CalendarSourceSelection.Local;

    public DateTimeOffset UpdatedAtUtc { get; set; }

    public Family Family { get; set; } = null!;
}

public sealed class GoogleCalendarConnection
{
    public Guid Id { get; set; }

    public string UserId { get; set; } = string.Empty;

    public Guid FamilyId { get; set; }

    public string GoogleAccountEmail { get; set; } = string.Empty;

    public string GoogleAccountSubject { get; set; } = string.Empty;

    public byte[] RefreshTokenCipher { get; set; } = Array.Empty<byte>();

    public byte[] RefreshTokenNonce { get; set; } = Array.Empty<byte>();

    public byte[] RefreshTokenTag { get; set; } = Array.Empty<byte>();

    public int KeyVersion { get; set; }

    public string GrantedScopes { get; set; } = string.Empty;

    public GoogleConnectionStatus Status { get; set; } = GoogleConnectionStatus.Connected;

    public DateTimeOffset ConnectedAtUtc { get; set; }

    public DateTimeOffset? LastSyncAtUtc { get; set; }

    public DateTimeOffset? LastErrorAtUtc { get; set; }

    public string? LastError { get; set; }

    public DateTimeOffset? CalendarsSyncedAtUtc { get; set; }

    public Family Family { get; set; } = null!;

    public ICollection<GoogleCalendarSubscription> Subscriptions { get; set; } = new List<GoogleCalendarSubscription>();
}

public sealed class GoogleCalendarSubscription
{
    public Guid Id { get; set; }

    public Guid ConnectionId { get; set; }

    public string GoogleCalendarId { get; set; } = string.Empty;

    public string Summary { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? ColorHex { get; set; }

    public string? TimeZone { get; set; }

    public string AccessRole { get; set; } = string.Empty;

    public bool IsPrimary { get; set; }

    public bool IsSelected { get; set; }

    public DateTimeOffset LastSeenAtUtc { get; set; }

    public GoogleCalendarConnection Connection { get; set; } = null!;
}

public sealed class GoogleOAuthState
{
    public Guid Id { get; set; }

    public string UserId { get; set; } = string.Empty;

    public string StateHash { get; set; } = string.Empty;

    public string CodeVerifier { get; set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset ExpiresAtUtc { get; set; }

    public DateTimeOffset? ConsumedAtUtc { get; set; }
}
