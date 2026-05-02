import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { fetchFamilyInvite, acceptFamilyInvite } from '../../shared/api/invites';
import { useAuthSession } from '../../processes/auth-session/AuthSessionContext';

const colorOptions = ['green', 'blue', 'pink', 'yellow'];

export function InvitePage() {
  const { t } = useTranslation('auth');
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { setSession } = useAuthSession();
  const [inviteDetails, setInviteDetails] = useState<Awaited<ReturnType<typeof fetchFamilyInvite>> | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [colorKey, setColorKey] = useState(colorOptions[0]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const isLinkedInvite = Boolean(inviteDetails?.profileId);

  useEffect(() => {
    setLoading(true);
    setError('');

    void fetchFamilyInvite(token)
      .then((details) => {
        setInviteDetails(details);
        setEmail(details.email);
      })
      .catch(() => {
        setError(t('invite.errors.load'));
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!password.trim() || (!isLinkedInvite && !displayName.trim())) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const session = await acceptFamilyInvite(token, {
        email: email.trim().toLowerCase(),
        password,
        displayName: isLinkedInvite ? null : displayName.trim(),
        colorKey: isLinkedInvite ? null : colorKey,
      });

      setSession({ accessToken: session.accessToken, expiresAtUtc: session.expiresAtUtc });
      navigate('/', { replace: true });
    } catch {
      setError(t('invite.errors.accept'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page standalone-page">
      <p className="eyebrow">{t('invite.eyebrow')}</p>
      <h2 className="page-title">{t('invite.heading')}</h2>

      {loading ? <p className="page-copy">{t('invite.loading')}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {inviteDetails ? (
        <>
          <p className="page-copy">
            {t('invite.join', {
              familyName: inviteDetails.familyName,
              email: inviteDetails.email,
            })}
          </p>

          {isLinkedInvite ? (
            <p className="page-copy invite-profile-copy">
              {t('invite.linkedProfile', { name: inviteDetails.profileDisplayName ?? '' })}
            </p>
          ) : null}

          {inviteDetails.isExpired ? <p className="form-error">{t('invite.expired')}</p> : null}
          {inviteDetails.isAccepted ? <p className="form-error">{t('invite.alreadyAccepted')}</p> : null}

          {!inviteDetails.isExpired && !inviteDetails.isAccepted ? (
            <form className="auth-form" onSubmit={handleAccept}>
              <label className="field">
                <span>{t('fields.email')}</span>
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
              </label>

              {isLinkedInvite ? null : (
                <label className="field">
                  <span>{t('fields.displayName')}</span>
                  <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} type="text" />
                </label>
              )}

              <label className="field">
                <span>{t('fields.password')}</span>
                <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
              </label>

              {isLinkedInvite ? null : (
                <label className="field">
                  <span>{t('fields.profileColor')}</span>
                  <select value={colorKey} onChange={(event) => setColorKey(event.target.value)}>
                    {colorOptions.map((option) => (
                      <option key={option} value={option}>
                        {t(`colors.${option}`)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? t('invite.submitting') : t('invite.submit')}
              </button>
            </form>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
