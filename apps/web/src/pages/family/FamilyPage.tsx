import { useState } from 'react';

import {
  useCreateProfile,
  useProfiles,
  useUpdateProfile,
} from '../../entities/profile/model/useProfiles';

const colorOptions = ['green', 'blue', 'pink', 'yellow'];

export function FamilyPage() {
  const profilesQuery = useProfiles();
  const createProfileMutation = useCreateProfile();
  const updateProfileMutation = useUpdateProfile();

  const [displayName, setDisplayName] = useState('');
  const [colorKey, setColorKey] = useState(colorOptions[0]);

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

  return (
    <section className="page">
      <p className="eyebrow">Family</p>
      <h2 className="page-title">Profiles and colors</h2>
      <p className="page-copy">
        Manage the family members used across the planner and keep their color keys consistent.
      </p>

      <form className="profile-form" onSubmit={handleCreate}>
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

      {profilesQuery.isLoading ? <p className="page-copy">Loading profiles...</p> : null}
      {profilesQuery.isError ? <p className="form-error">Unable to load profiles.</p> : null}

      <div className="profile-grid">
        {profilesQuery.data?.map((profile) => (
          <article key={profile.id} className="profile-card">
            <div className="profile-card-header">
              <div>
                <p className="eyebrow">Profile</p>
                <h3 className="profile-card-title">{profile.displayName}</h3>
              </div>
              <span className="profile-color-chip">{profile.colorKey}</span>
            </div>

            <label className="toggle-row">
              <span>{profile.isActive ? 'Active' : 'Inactive'}</span>
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
