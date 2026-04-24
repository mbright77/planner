import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { login, register } from '../../shared/api/auth';
import { useAuthSession } from '../../processes/auth-session/AuthSessionContext';

const colorOptions = ['green', 'blue', 'pink', 'yellow'];
const timezoneOptions = [
  'UTC',
  'Europe/Stockholm',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Helsinki',
  'Europe/Oslo',
  'Europe/Copenhagen',
  'Europe/Warsaw',
  'Europe/Amsterdam',
  'Europe/Zurich',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'America/Sao_Paulo',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
] as const;

function formatTimezoneLabel(value: string) {
  return value.replace(/_/g, ' ');
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAuthSession();

  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [colorKey, setColorKey] = useState(colorOptions[0]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const destination = (location.state as { from?: string } | null)?.from ?? '/';
  const availableTimezones = timezoneOptions.includes(timezone as (typeof timezoneOptions)[number])
    ? timezoneOptions
    : [timezone, ...timezoneOptions];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = mode === 'signin'
        ? await login({ email: email.trim().toLowerCase(), password })
        : await register({
            email: email.trim().toLowerCase(),
            password,
            familyName: familyName.trim(),
            displayName: displayName.trim(),
            timezone,
            colorKey,
          });

      setSession({ accessToken: response.accessToken, expiresAtUtc: response.expiresAtUtc });
      navigate(destination, { replace: true });
    } catch {
      setError(mode === 'signin' ? 'Unable to sign in with those details.' : 'Unable to create your family account.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page" aria-labelledby="auth-title">
      <section className="page standalone-page auth-panel">
        <div className="auth-hero">
          <p className="eyebrow">Family planner</p>
          <h1 id="auth-title" className="page-title">Keep the week in sync</h1>
          <p className="page-copy">
            Sign in to your shared planner or create a family workspace with calendars, meals, shopping, and profiles.
          </p>
        </div>

        <div className="auth-toggle" role="tablist" aria-label="Authentication mode">
          <button
            className={mode === 'signin' ? 'auth-toggle-button auth-toggle-button-active' : 'auth-toggle-button'}
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            onClick={() => setMode('signin')}
          >
            Sign in
          </button>
          <button
            className={mode === 'register' ? 'auth-toggle-button auth-toggle-button-active' : 'auth-toggle-button'}
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            onClick={() => setMode('register')}
          >
            Create family
          </button>
        </div>

        {error ? <p className="form-error" role="alert">{error}</p> : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
          </label>

          <label className="field">
            <span>Password</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required />
          </label>

          {mode === 'register' ? (
            <>
              <label className="field">
                <span>Family name</span>
                <input value={familyName} onChange={(event) => setFamilyName(event.target.value)} type="text" required />
              </label>

              <label className="field">
                <span>Your display name</span>
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} type="text" required />
              </label>

              <label className="field">
                <span>Timezone</span>
                <select value={timezone} onChange={(event) => setTimezone(event.target.value)} required>
                  {availableTimezones.map((option) => (
                    <option key={option} value={option}>
                      {formatTimezoneLabel(option)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Profile color</span>
                <select value={colorKey} onChange={(event) => setColorKey(event.target.value)}>
                  {colorOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <div className="auth-actions">
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : mode === 'signin' ? 'Sign in' : 'Create family'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
