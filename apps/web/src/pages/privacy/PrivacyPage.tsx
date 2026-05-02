import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { useBootstrap } from '../../processes/family-bootstrap/useBootstrap';
import { useAuthSession } from '../../processes/auth-session/AuthSessionContext';
import { deleteAccount, deleteFamily } from '../../shared/api/privacy';

export function PrivacyPage() {
  const { t } = useTranslation('family');
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
      setError(t('privacy.errors.deleteAccount'));
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
      setError(t('privacy.errors.deleteFamily'));
    } finally {
      setIsDeletingFamily(false);
    }
  }

  return (
    <section className="page standalone-page">
      <p className="eyebrow">{t('privacy.eyebrow')}</p>
      <h2 className="page-title">{t('privacy.title')}</h2>
      <p className="page-copy">
        {t('privacy.description')}
      </p>

      {error ? <p className="form-error">{error}</p> : null}

      <form className="profile-form privacy-card" onSubmit={handleDeleteAccount}>
        <div>
          <h3 className="profile-card-title">{t('privacy.deleteAccount.title')}</h3>
          <p className="page-copy">{t('privacy.deleteAccount.description')}</p>
        </div>

        <label className="field">
          <span>{t('privacy.password')}</span>
          <input value={accountPassword} onChange={(event) => setAccountPassword(event.target.value)} type="password" />
        </label>

        <button className="secondary-button destructive-button" type="submit" disabled={isDeletingAccount}>
          {isDeletingAccount ? t('privacy.deleting') : t('privacy.deleteAccount.action')}
        </button>
      </form>

      {isAdmin ? (
        <form className="profile-form privacy-card" onSubmit={handleDeleteFamily}>
          <div>
            <h3 className="profile-card-title">{t('privacy.deleteFamily.title')}</h3>
            <p className="page-copy">{t('privacy.deleteFamily.description')}</p>
          </div>

          <label className="field">
            <span>{t('privacy.password')}</span>
            <input value={familyPassword} onChange={(event) => setFamilyPassword(event.target.value)} type="password" />
          </label>

          <button className="secondary-button destructive-button" type="submit" disabled={isDeletingFamily}>
            {isDeletingFamily ? t('privacy.deleting') : t('privacy.deleteFamily.action')}
          </button>
        </form>
      ) : null}

      <p className="page-copy">
        <Link className="inline-action-link" to="/family">{t('privacy.backToFamilySettings')}</Link>
      </p>
    </section>
  );
}
