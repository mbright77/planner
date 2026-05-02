import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { useCreateFamilyInvite, useFamilyInvites } from '../../entities/invite/model/useFamilyInvites';
import { useBootstrap } from '../../processes/family-bootstrap/useBootstrap';
import {
  useCreateProfile,
  useProfiles,
  useUpdateProfile,
} from '../../entities/profile/model/useProfiles';

const colorOptions = ['green', 'blue', 'pink', 'yellow'];
const languageOptions = ['en', 'sv'] as const;

function getProfileColorChipClass(colorKey: string | null | undefined) {
  return colorKey ? `profile-color-chip profile-color-chip-${colorKey}` : 'profile-color-chip';
}

export function FamilyPage() {
  const { t } = useTranslation('family');
  const bootstrapQuery = useBootstrap();
  const profilesQuery = useProfiles();
  const familyInvitesQuery = useFamilyInvites();
  const createProfileMutation = useCreateProfile();
  const createFamilyInviteMutation = useCreateFamilyInvite();
  const updateProfileMutation = useUpdateProfile();

  const [displayName, setDisplayName] = useState('');
  const [colorKey, setColorKey] = useState(colorOptions[0]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteProfileId, setInviteProfileId] = useState('');
  const isAdmin = bootstrapQuery.data?.membership.role === 'Admin';
  const currentUserId = bootstrapQuery.data?.membership.userId;
  const inviteableProfiles = (profilesQuery.data ?? []).filter((profile) => profile.isActive && !profile.hasLogin);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!displayName.trim()) {
      return;
    }

    await createProfileMutation.mutateAsync({
      displayName: displayName.trim(),
      colorKey,
      preferredLanguage: null,
    });

    setDisplayName('');
    setColorKey(colorOptions[0]);
  }

  async function handleToggle(profileId: string, nextActive: boolean, currentName: string, currentColor: string, currentPreferredLanguage: string | null) {
    await updateProfileMutation.mutateAsync({
      profileId,
      request: {
        displayName: currentName,
        colorKey: currentColor,
        isActive: nextActive,
        preferredLanguage: currentPreferredLanguage,
      },
    });
  }

  async function handleLanguageChange(
    profileId: string,
    nextLanguage: string,
    currentName: string,
    currentColor: string,
    isActive: boolean,
  ) {
    await updateProfileMutation.mutateAsync({
      profileId,
      request: {
        displayName: currentName,
        colorKey: currentColor,
        isActive,
        preferredLanguage: nextLanguage,
      },
    });
  }

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!inviteEmail.trim()) {
      return;
    }

    const selectedProfile = inviteableProfiles.find((profile) => profile.id === inviteProfileId);

    await createFamilyInviteMutation.mutateAsync({
      email: inviteEmail.trim().toLowerCase(),
      profileId: selectedProfile?.id ?? null,
    });

    setInviteEmail('');
    setInviteProfileId('');
  }

  return (
    <section className="page">
      <p className="eyebrow">{t('eyebrow')}</p>
      <h2 className="page-title">{t('title')}</h2>
      <p className="page-copy">
        {t('description')}
      </p>
      <p className="page-copy">
        <Link className="inline-action-link" to="/settings/privacy">{t('privacyLink')}</Link>
      </p>

      <form className="profile-form family-create-card" onSubmit={handleCreate}>
        <label className="field">
          <span>{t('fields.displayName')}</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={t('fields.displayNamePlaceholder')}
            type="text"
          />
        </label>

        <label className="field">
          <span>{t('fields.colorKey')}</span>
          <div className="profile-color-picker" role="radiogroup" aria-label={t('fields.profileColorAria')}>
            {colorOptions.map((option) => (
              <button
                key={option}
                className={
                  colorKey === option
                    ? `profile-color-picker-button profile-color-picker-button-${option} profile-color-picker-button-active`
                    : `profile-color-picker-button profile-color-picker-button-${option}`
                }
                type="button"
                role="radio"
                aria-checked={colorKey === option}
                aria-label={t('fields.selectColorAria', { color: t(`colors.${option}`) })}
                onClick={() => setColorKey(option)}
              >
                <span className="profile-color-picker-swatch" aria-hidden="true" />
                <span>{t(`colors.${option}`)}</span>
              </button>
            ))}
          </div>
        </label>

        <button className="secondary-button family-create-submit" type="submit" disabled={createProfileMutation.isPending}>
          {createProfileMutation.isPending ? t('saving') : t('addMember')}
        </button>
      </form>

      {isAdmin ? (
        <section className="invite-panel">
          <div className="profile-card-header family-section-header">
            <div>
              <p className="eyebrow">{t('invites.eyebrow')}</p>
              <h3 className="profile-card-title">{t('invites.title')}</h3>
              <p className="page-copy">
                {t('invites.description')}
              </p>
            </div>
          </div>

          <form className="profile-form" onSubmit={handleInvite}>
            <label className="field">
              <span>{t('invites.email')}</span>
              <input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder={t('invites.emailPlaceholder')}
                type="email"
              />
            </label>

            <label className="field">
              <span>{t('invites.linkProfileOptional')}</span>
              <select value={inviteProfileId} onChange={(event) => setInviteProfileId(event.target.value)}>
                <option value="">{t('invites.newProfile')}</option>
                {inviteableProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.displayName}
                  </option>
                ))}
              </select>
            </label>

            <button className="secondary-button" type="submit" disabled={createFamilyInviteMutation.isPending}>
              {createFamilyInviteMutation.isPending ? t('invites.creating') : t('invites.createLink')}
            </button>
          </form>

          <p className="page-copy family-invite-helper">
            {t('invites.helper')}
          </p>

          {familyInvitesQuery.isLoading ? <p className="page-copy">{t('invites.loading')}</p> : null}
          {familyInvitesQuery.isError ? <p className="form-error">{t('invites.error')}</p> : null}

          <div className="invite-list">
            {familyInvitesQuery.data?.map((invite) => {
              const inviteUrl = `${window.location.origin}/invite/${invite.token}`;

              return (
                <article key={invite.id} className="invite-card">
                  <div>
                    <strong>{invite.email}</strong>
                    {invite.profileDisplayName ? (
                      <p className="shopping-meta">{t('invites.linkedTo', { name: invite.profileDisplayName })}</p>
                    ) : null}
                    <p className="shopping-meta">{t('invites.expires', { date: new Date(invite.expiresAtUtc).toLocaleString() })}</p>
                    <p className="invite-link">{inviteUrl}</p>
                  </div>
                  <span className="profile-color-chip">{invite.isAccepted ? t('invites.accepted') : t('invites.pending')}</span>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {profilesQuery.isLoading ? <p className="page-copy">{t('loading')}</p> : null}
      {profilesQuery.isError ? <p className="form-error">{t('error')}</p> : null}

      <div className="profile-grid">
        {profilesQuery.data?.map((profile, index) => (
          <article
            key={profile.id}
            className={
              index === 0
                ? `profile-card profile-card-${profile.colorKey} profile-card-active`
                : `profile-card profile-card-${profile.colorKey}`
            }
          >
            <div className="profile-card-header">
              <div className="profile-card-identity">
                <div className={index === 0 ? 'profile-avatar profile-avatar-large' : 'profile-avatar'} aria-hidden="true">{profile.displayName.slice(0, 1).toUpperCase()}</div>
                <div>
                  <p className="eyebrow">{t('profile.eyebrow')}</p>
                  <h3 className="profile-card-title">{profile.displayName}</h3>
                  <span className="profile-role-chip">{profile.isActive ? t('profile.activeMember') : t('profile.inactiveMember')}</span>
                  {index === 0 ? <span className="profile-active-badge">{t('profile.activeBadge')}</span> : null}
                </div>
              </div>
              <span className={getProfileColorChipClass(profile.colorKey)}>{t(`colors.${profile.colorKey}`)}</span>
            </div>

            <div className="profile-card-stats">
              <div className="profile-stat-card">
                <span className="profile-stat-label">{t('stats.status')}</span>
                <span className="profile-stat-value">{profile.isActive ? t('stats.active') : t('stats.inactive')}</span>
              </div>
              <div className="profile-stat-card">
                <span className="profile-stat-label">{t('stats.colorIdentity')}</span>
                <span className="profile-stat-value">{t(`colors.${profile.colorKey}`)}</span>
              </div>
              <div className="profile-stat-card">
                <span className="profile-stat-label">{t('stats.signInAccess')}</span>
                <span className="profile-stat-value">{profile.hasLogin ? t('stats.hasLogin') : t('stats.profileOnly')}</span>
              </div>
            </div>

            <label className="toggle-row profile-toggle-row">
              <span className="profile-toggle-copy">
                <strong>{profile.isActive ? t('toggle.included') : t('toggle.hidden')}</strong>
                <span className="shopping-meta">
                  {profile.isActive
                    ? t('toggle.includedHint')
                    : t('toggle.hiddenHint')}
                </span>
              </span>
              <input
                type="checkbox"
                checked={profile.isActive}
                onChange={(event) =>
                  handleToggle(
                    profile.id,
                    event.target.checked,
                    profile.displayName,
                    profile.colorKey,
                    profile.preferredLanguage,
                  )
                }
              />
            </label>

            {profile.linkedUserId === currentUserId ? (
              <label className="field">
                <span>{t('preferredLanguage')}</span>
                <select
                  value={profile.preferredLanguage ?? 'en'}
                  onChange={(event) =>
                    handleLanguageChange(
                      profile.id,
                      event.target.value,
                      profile.displayName,
                      profile.colorKey,
                      profile.isActive,
                    )
                  }
                  disabled={updateProfileMutation.isPending}
                >
                  {languageOptions.map((option) => (
                    <option key={option} value={option}>
                      {t(`languages.${option}`)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
