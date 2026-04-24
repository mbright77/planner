import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { fetchFamilyInvite, acceptFamilyInvite } from '../../shared/api/invites';
import { useAuthSession } from '../../processes/auth-session/AuthSessionContext';

const colorOptions = ['green', 'blue', 'pink', 'yellow'];

export function InvitePage() {
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

  useEffect(() => {
    setLoading(true);
    setError('');

    void fetchFamilyInvite(token)
      .then((details) => {
        setInviteDetails(details);
        setEmail(details.email);
      })
      .catch(() => {
        setError('Unable to load this invite.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!displayName.trim() || !password.trim()) {
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const session = await acceptFamilyInvite(token, {
        email: email.trim().toLowerCase(),
        password,
        displayName: displayName.trim(),
        colorKey,
      });

      setSession({ accessToken: session.accessToken, expiresAtUtc: session.expiresAtUtc });
      navigate('/', { replace: true });
    } catch {
      setError('Unable to accept this invite.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page standalone-page">
      <p className="eyebrow">Invitation</p>
      <h2 className="page-title">Join a family</h2>

      {loading ? <p className="page-copy">Loading invite...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {inviteDetails ? (
        <>
          <p className="page-copy">
            Join <strong>{inviteDetails.familyName}</strong> with the invite sent to <strong>{inviteDetails.email}</strong>.
          </p>

          {inviteDetails.isExpired ? <p className="form-error">This invite has expired.</p> : null}
          {inviteDetails.isAccepted ? <p className="form-error">This invite has already been accepted.</p> : null}

          {!inviteDetails.isExpired && !inviteDetails.isAccepted ? (
            <form className="auth-form" onSubmit={handleAccept}>
              <label className="field">
                <span>Email</span>
                <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
              </label>

              <label className="field">
                <span>Display name</span>
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} type="text" />
              </label>

              <label className="field">
                <span>Password</span>
                <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
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

              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? 'Joining...' : 'Join family'}
              </button>
            </form>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
