namespace Planner.Domain;

public interface IAssemblyMarker;

public enum FamilyRole
{
    Admin = 1,
    Member = 2,
}

public sealed class Family
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Timezone { get; set; } = "UTC";

    public DateTimeOffset CreatedAtUtc { get; set; }

    public ICollection<Profile> Profiles { get; set; } = new List<Profile>();

    public ICollection<FamilyMembership> Memberships { get; set; } = new List<FamilyMembership>();

    public ICollection<ShoppingItem> ShoppingItems { get; set; } = new List<ShoppingItem>();
}

public sealed class Profile
{
    public Guid Id { get; set; }

    public Guid FamilyId { get; set; }

    public string DisplayName { get; set; } = string.Empty;

    public string ColorKey { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public Family Family { get; set; } = null!;
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
