import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useCreateFamilyInvite, useFamilyInvites } from '../../entities/invite/model/useFamilyInvites';
import { useBootstrap } from '../../processes/family-bootstrap/useBootstrap';
import {
  useCreateProfile,
  useProfiles,
  useUpdateProfile,
} from '../../entities/profile/model/useProfiles';

const colorOptions = ['green', 'blue', 'pink', 'yellow'];

export function FamilyPage() {
  const bootstrapQuery = useBootstrap();
  const profilesQuery = useProfiles();
  const familyInvitesQuery = useFamilyInvites();
  const createProfileMutation = useCreateProfile();
  const createFamilyInviteMutation = useCreateFamilyInvite();
  const updateProfileMutation = useUpdateProfile();

  const [displayName, setDisplayName] = useState('');
  const [colorKey, setColorKey] = useState(colorOptions[0]);
  const [inviteEmail, setInviteEmail] = useState('');
  const isAdmin = bootstrapQuery.data?.membership.role === 'Admin';

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!displayName.trim()) {
      return;
    }

    await createProfileMutation.mutateAsync({
      displayName: displayName.trim(),
      colorKey,
    });

    setDisplayName('');
    setColorKey(colorOptions[0]);
  }

  async function handleToggle(profileId: string, nextActive: boolean, currentName: string, currentColor: string) {
    await updateProfileMutation.mutateAsync({
      profileId,
      request: {
        displayName: currentName,
        colorKey: currentColor,
        isActive: nextActive,
      },
    });
  }

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!inviteEmail.trim()) {
      return;
    }

    await createFamilyInviteMutation.mutateAsync({ email: inviteEmail.trim().toLowerCase() });
    setInviteEmail('');
  }

  return (
    <section className="page">
      <p className="eyebrow">Family</p>
      <h2 className="page-title">Profiles and colors</h2>
      <p className="page-copy">
        Manage the family members used across the planner and keep their color keys consistent.
      </p>
      <p className="page-copy">
        <Link className="inline-action-link" to="/settings/privacy">Review deletion and privacy options</Link>
      </p>

      <form className="profile-form family-create-card" onSubmit={handleCreate}>
        <label className="field">
          <span>Display name</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Add a family member"
            type="text"
          />
        </label>

        <label className="field">
          <span>Color key</span>
          <select value={colorKey} onChange={(event) => setColorKey(event.target.value)}>
            {colorOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <button className="primary-button" type="submit" disabled={createProfileMutation.isPending}>
          {createProfileMutation.isPending ? 'Saving...' : 'Add profile'}
        </button>
      </form>

      {isAdmin ? (
        <section className="invite-panel">
          <div className="profile-card-header family-section-header">
            <div>
              <p className="eyebrow">Invites</p>
              <h3 className="profile-card-title">Invite a family member</h3>
              <p className="page-copy">
                Invited family members can sign in, view the shared planner, add calendar items, request and plan meals, and update shopping.
              </p>
            </div>
          </div>

          <form className="profile-form" onSubmit={handleInvite}>
            <label className="field">
              <span>Email</span>
              <input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="name@example.com"
                type="email"
              />
            </label>

            <button className="secondary-button" type="submit" disabled={createFamilyInviteMutation.isPending}>
              {createFamilyInviteMutation.isPending ? 'Creating...' : 'Create invite link'}
            </button>
          </form>

          {familyInvitesQuery.isLoading ? <p className="page-copy">Loading invites...</p> : null}
          {familyInvitesQuery.isError ? <p className="form-error">Unable to load invites.</p> : null}

          <div className="invite-list">
            {familyInvitesQuery.data?.map((invite) => {
              const inviteUrl = `${window.location.origin}/invite/${invite.token}`;

              return (
                <article key={invite.id} className="invite-card">
                  <div>
                    <strong>{invite.email}</strong>
                    <p className="shopping-meta">Expires {new Date(invite.expiresAtUtc).toLocaleString()}</p>
                    <p className="invite-link">{inviteUrl}</p>
                  </div>
                  <span className="profile-color-chip">{invite.isAccepted ? 'Accepted' : 'Pending'}</span>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {profilesQuery.isLoading ? <p className="page-copy">Loading profiles...</p> : null}
      {profilesQuery.isError ? <p className="form-error">Unable to load profiles.</p> : null}

      <div className="profile-grid">
        {profilesQuery.data?.map((profile) => (
          <article key={profile.id} className={`profile-card profile-card-${profile.colorKey}`}>
            <div className="profile-card-color-bar" aria-hidden="true" />
            <div className="profile-card-header">
              <div className="profile-card-identity">
                <div className="profile-avatar" aria-hidden="true">{profile.displayName.slice(0, 1).toUpperCase()}</div>
                <div>
                  <p className="eyebrow">Profile</p>
                  <h3 className="profile-card-title">{profile.displayName}</h3>
                  <span className="profile-role-chip">{profile.isActive ? 'Active member' : 'Inactive member'}</span>
                </div>
              </div>
              <span className="profile-color-chip">{profile.colorKey}</span>
            </div>

            <div className="profile-card-stats">
              <div className="profile-stat-card">
                <span className="profile-stat-label">Status</span>
                <span className="profile-stat-value">{profile.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="profile-stat-card">
                <span className="profile-stat-label">Color identity</span>
                <span className="profile-stat-value">{profile.colorKey}</span>
              </div>
            </div>

            <label className="toggle-row profile-toggle-row">
              <span>{profile.isActive ? 'Included in planning' : 'Hidden from planning'}</span>
              <input
                type="checkbox"
                checked={profile.isActive}
                onChange={(event) =>
                  handleToggle(profile.id, event.target.checked, profile.displayName, profile.colorKey)
                }
              />
            </label>
          </article>
        ))}
      </div>
    </section>
  );
}
