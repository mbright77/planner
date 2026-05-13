import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
    <main className="flex min-h-[calc(100dvh-7rem)] items-center justify-center bg-gradient-to-b from-muted/50 to-background px-4 py-8">
      <Card className="w-full max-w-xl">
        <CardHeader className="gap-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('invite.eyebrow')}</p>
          <CardTitle className="text-2xl md:text-3xl">{t('invite.heading')}</CardTitle>
          {inviteDetails ? (
            <CardDescription>
              {t('invite.join', {
                familyName: inviteDetails.familyName,
                email: inviteDetails.email,
              })}
            </CardDescription>
          ) : null}
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {loading ? (
            <Alert>
              <AlertDescription>{t('invite.loading')}</AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {inviteDetails ? (
            <>
              {isLinkedInvite ? (
                <p className="text-sm text-muted-foreground">
                  {t('invite.linkedProfile', { name: inviteDetails.profileDisplayName ?? '' })}
                </p>
              ) : null}

              {inviteDetails.isExpired ? (
                <Alert variant="destructive">
                  <AlertDescription>{t('invite.expired')}</AlertDescription>
                </Alert>
              ) : null}

              {inviteDetails.isAccepted ? (
                <Alert variant="destructive">
                  <AlertDescription>{t('invite.alreadyAccepted')}</AlertDescription>
                </Alert>
              ) : null}

              {!inviteDetails.isExpired && !inviteDetails.isAccepted ? (
                <form className="flex flex-col gap-4" onSubmit={handleAccept}>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="invite-email">{t('fields.email')}</Label>
                    <Input
                      id="invite-email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      type="email"
                    />
                  </div>

                  {isLinkedInvite ? null : (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="invite-display-name">{t('fields.displayName')}</Label>
                      <Input
                        id="invite-display-name"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        type="text"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="invite-password">{t('fields.password')}</Label>
                    <Input
                      id="invite-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type="password"
                    />
                  </div>

                  {isLinkedInvite ? null : (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="invite-profile-color">{t('fields.profileColor')}</Label>
                      <Select value={colorKey} onValueChange={setColorKey}>
                        <SelectTrigger id="invite-profile-color" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {colorOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {t(`colors.${option}`)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Button type="submit" disabled={submitting}>
                    {submitting ? t('invite.submitting') : t('invite.submit')}
                  </Button>
                </form>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
