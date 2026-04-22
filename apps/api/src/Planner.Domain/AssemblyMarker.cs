namespace Planner.Domain;

public interface IAssemblyMarker;

public sealed class Family
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Timezone { get; set; } = "UTC";

    public DateTimeOffset CreatedAtUtc { get; set; }

    public ICollection<Profile> Profiles { get; set; } = new List<Profile>();
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
