import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useBootstrap } from '../../processes/family-bootstrap/useBootstrap';
import { useAuthSession } from '../../processes/auth-session/AuthSessionContext';
import { deleteAccount, deleteFamily } from '../../shared/api/privacy';

export function PrivacyPage() {
  const navigate = useNavigate();
  const bootstrapQuery = useBootstrap();
  const { clearSession, session } = useAuthSession();
  const [accountPassword, setAccountPassword] = useState('');
  const [familyPassword, setFamilyPassword] = useState('');
  const [error, setError] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isDeletingFamily, setIsDeletingFamily] = useState(false);

  const isAdmin = bootstrapQuery.data?.membership.role === 'Admin';

  async function handleDeleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.accessToken || !accountPassword.trim()) {
      return;
    }

    setIsDeletingAccount(true);
    setError('');

    try {
      await deleteAccount(session.accessToken, { password: accountPassword });
      clearSession();
      navigate('/login', { replace: true });
    } catch {
      setError('Unable to delete account.');
    } finally {
      setIsDeletingAccount(false);
    }
  }

  async function handleDeleteFamily(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.accessToken || !familyPassword.trim()) {
      return;
    }

    setIsDeletingFamily(true);
    setError('');

    try {
      await deleteFamily(session.accessToken, { password: familyPassword });
      clearSession();
      navigate('/login', { replace: true });
    } catch {
      setError('Unable to delete family.');
    } finally {
      setIsDeletingFamily(false);
    }
  }

  return (
    <section className="page standalone-page">
      <p className="eyebrow">Privacy</p>
      <h2 className="page-title">Deletion and privacy</h2>
      <p className="page-copy">
        Confirm destructive actions with your password. These flows are designed for permanent cleanup.
      </p>

      {error ? <p className="form-error">{error}</p> : null}

      <form className="profile-form privacy-card" onSubmit={handleDeleteAccount}>
        <div>
          <h3 className="profile-card-title">Delete my account</h3>
          <p className="page-copy">Leave the planner and remove your account. This is blocked if you are the only family member.</p>
        </div>

        <label className="field">
          <span>Password</span>
          <input value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} type="password" />
        </label>

        <button className="secondary-button destructive-button" type="submit" disabled={isDeletingAccount}>
          {isDeletingAccount ? 'Deleting...' : 'Delete my account'}
        </button>
      </form>

      {isAdmin ? (
        <form className="profile-form privacy-card" onSubmit={handleDeleteFamily}>
          <div>
            <h3 className="profile-card-title">Delete family</h3>
            <p className="page-copy">Remove the entire family planner, including profiles, invites, events, meals, and shopping data.</p>
          </div>

          <label className="field">
            <span>Password</span>
            <input value={familyPassword} onChange={(event) => setFamilyPassword(event.target.value)} type="password" />
          </label>

          <button className="secondary-button destructive-button" type="submit" disabled={isDeletingFamily}>
            {isDeletingFamily ? 'Deleting...' : 'Delete family'}
          </button>
        </form>
      ) : null}

      <p className="page-copy">
        <Link to="/family">Back to family settings</Link>
      </p>
    </section>
  );
}
