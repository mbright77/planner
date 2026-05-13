import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserIcon } from '@hugeicons/core-free-icons';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <section className="flex flex-col gap-4 py-4 md:gap-6">
      <Card>
        <CardHeader>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('privacy.eyebrow')}</p>
          <CardTitle className="text-2xl md:text-3xl">{t('privacy.title')}</CardTitle>
          <CardDescription>{t('privacy.description')}</CardDescription>
          <div>
            <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" to="/family">
              {t('privacy.backToFamilySettings')}
            </Link>
          </div>
        </CardHeader>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HugeiconsIcon icon={UserIcon} aria-hidden="true" />
            {t('privacy.deleteAccount.title')}
          </CardTitle>
          <CardDescription>{t('privacy.deleteAccount.description')}</CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={handleDeleteAccount}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="account-password">{t('privacy.password')}</Label>
              <Input
                id="account-password"
                value={accountPassword}
                onChange={(event) => setAccountPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" variant="destructive" disabled={isDeletingAccount || !accountPassword.trim()}>
              {isDeletingAccount ? t('privacy.deleting') : t('privacy.deleteAccount.action')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('privacy.deleteFamily.title')}</CardTitle>
            <CardDescription>{t('privacy.deleteFamily.description')}</CardDescription>
          </CardHeader>

          <CardContent>
            <form className="space-y-4" onSubmit={handleDeleteFamily}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="family-password">{t('privacy.password')}</Label>
                <Input
                  id="family-password"
                  value={familyPassword}
                  onChange={(event) => setFamilyPassword(event.target.value)}
                  type="password"
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" variant="destructive" disabled={isDeletingFamily || !familyPassword.trim()}>
                {isDeletingFamily ? t('privacy.deleting') : t('privacy.deleteFamily.action')}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
