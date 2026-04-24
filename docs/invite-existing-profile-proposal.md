# Invite Existing Profile Proposal

## Goal

Support this flow cleanly:

1. A family admin creates planner profiles for family members.
2. Later, the admin decides that one of those family members should get sign-in access.
3. The admin sends an invite tied to that existing profile.
4. When the invite is accepted, the new user account joins the family and is linked to the existing profile instead of creating a duplicate profile.

This keeps family identity stable across calendar assignments, meals, meal requests, and shopping history.

## Current Problem

Today, invite acceptance always creates a new `Profile`:

- backend: `apps/api/src/Planner.Api/Endpoints/InviteEndpoints.cs`
- flow: `AcceptInviteAsync(...)`

That means a family can end up with:

- an existing planner profile created earlier by the admin
- a second profile created during invite acceptance for the same person

This creates identity duplication and makes assignments feel unreliable.

## Proposed Product Behavior

### Admin Flow

On the Family page, the admin should have two distinct actions:

- `Add profile`
- `Give sign-in access`

The invite action should let the admin either:

1. invite a new family member without an existing profile, or
2. invite an existing profile to get sign-in access

Recommended default:

- if the admin starts from an existing profile card, the invite form should already be linked to that profile

### Invite Acceptance Flow

If an invite is linked to an existing profile:

- create the user account
- create the `FamilyMembership`
- link that existing profile to the new user account
- do not create a second profile

If an invite is not linked to a profile:

- keep the current behavior of creating a new profile during acceptance

## Minimal Data Model Change

Current domain model:

- `Profile` has no account-link field

Add:

- `Profile.LinkedUserId` nullable string

This matches the implementation plan direction and enables clean account-to-profile linkage.

Also add to `FamilyInvite`:

- `ProfileId` nullable `Guid`

This lets an invite explicitly target an existing profile.

## Backend Changes

### 1. Domain

Update `apps/api/src/Planner.Domain/AssemblyMarker.cs`:

- add `string? LinkedUserId` to `Profile`
- add `Guid? ProfileId` to `FamilyInvite`

### 2. EF Core

Update persistence:

- add configuration for the new columns
- add indexes as appropriate
- generate an EF migration with repo tooling

Suggested constraints:

- `Profile.LinkedUserId` should be nullable
- unique index on `profiles(linked_user_id)` filtered where not null
- optional foreign key from `FamilyInvite.ProfileId` to `Profile.Id`

### 3. Contracts

Update invite contracts in `apps/api/src/Planner.Contracts/Invites/InviteContracts.cs`:

- `CreateFamilyInviteRequest` should accept optional `profileId`
- `FamilyInviteResponse` should include optional `profileId`
- `FamilyInviteDetailsResponse` should optionally include profile summary data when linked

Recommended addition:

```csharp
public sealed record CreateFamilyInviteRequest(string Email, Guid? ProfileId);
```

### 4. Invite Creation Endpoint

Update `CreateInviteAsync(...)`:

- if `profileId` is provided, verify the profile belongs to the same family
- reject linking to a profile already linked to another user
- save `invite.ProfileId`

### 5. Invite Acceptance Endpoint

Update `AcceptInviteAsync(...)`:

- if `invite.ProfileId` exists:
  - load the profile within the invite family
  - reject if already linked
  - update `profile.LinkedUserId = user.Id`
  - optionally update `DisplayName` only if product wants acceptance-time rename behavior
  - do not create a new profile
- else:
  - keep existing profile creation flow

Recommended behavior for display name:

- preserve the existing profile display name by default
- only show the display-name field during invite acceptance when no profile is pre-linked

This avoids accidental renaming of a profile the family already uses everywhere.

## Frontend Changes

### 1. Family Page

Update `apps/web/src/pages/family/FamilyPage.tsx`:

- change invite UI to `Invite a family member`
- add an optional existing-profile selector in the invite form
- filter selector to active profiles that are not already linked to a login

Recommended copy:

- `Link to existing profile (optional)`
- helper text: `Use this when someone already appears in your planner and now needs sign-in access.`

### 2. Invite Cards

Show whether an invite is linked to a profile:

- `Linked to Emma`

This helps admins understand what will happen when the invite is accepted.

### 3. Invite Acceptance Page

Update `apps/web/src/pages/invite/InvitePage.tsx`:

- if the invite is linked to an existing profile:
  - remove or disable the display-name field
  - keep password and maybe color hidden if color already exists on the profile
  - explain that the account will connect to the existing profile
- if no profile is linked:
  - keep the current display-name and color flow

Recommended copy for linked invites:

- `This invite will connect your sign-in to the existing profile Emma.`

## Query and Bootstrap Implications

Bootstrap currently returns profiles without linked-user metadata.

Recommended improvement:

- extend bootstrap/profile responses with optional `linkedUserId` or `hasLogin`

That allows the Family page to show:

- `Has sign-in access`
- `Profile only`

This is not strictly required for the first pass, but it would greatly improve admin clarity.

## Suggested UX Rules

### When a Profile Already Exists

- admin should prefer `Give sign-in access`
- invite should link to that profile
- acceptance should not ask the invited person to redefine identity attributes already owned by the profile

### When No Profile Exists Yet

- invite can behave as it does today and create a new profile during acceptance

## Migration Strategy

Safe rollout path:

1. add nullable `Profile.LinkedUserId`
2. add nullable `FamilyInvite.ProfileId`
3. update backend endpoints to support linked invites
4. update frontend invite form and acceptance flow
5. later, optionally add `hasLogin` to bootstrap/profile responses for clearer family management UI

## Recommended Implementation Order

1. Add domain fields and EF migration.
2. Extend invite contracts and endpoint validation.
3. Update invite acceptance to link existing profiles when `ProfileId` is present.
4. Update Family page invite UI with optional profile linking.
5. Update Invite page to show linked-profile acceptance behavior.
6. Optionally extend bootstrap/profile payloads to expose login-linked state more clearly.

## Result

After this change, the current parent-to-teenager flow becomes coherent:

1. Parent creates family.
2. Parent creates teen profile.
3. Parent chooses `Give sign-in access` for that profile.
4. Teen accepts invite.
5. Teen account links to the existing profile.
6. Teen can read planner data, add calendar items, request meals, plan meals, and update shopping without creating duplicate identities.
