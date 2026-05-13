import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  const { t } = useTranslation('auth');
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
      setError(mode === 'signin' ? t('errors.signIn') : t('errors.createFamily'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      className="flex min-h-[calc(100dvh-7rem)] items-center justify-center bg-gradient-to-b from-muted/50 to-background px-4 py-8"
      aria-labelledby="auth-title"
    >
      <Card className="w-full max-w-xl">
        <CardHeader className="gap-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('eyebrow')}</p>
          <CardTitle id="auth-title" className="text-2xl md:text-3xl">
            {t('tagline')}
          </CardTitle>
          <CardDescription>{t('subtext')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Tabs
            value={mode}
            onValueChange={(value) => setMode(value as 'signin' | 'register')}
            aria-label={t('authModeAria')}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">{t('tabs.signIn')}</TabsTrigger>
              <TabsTrigger value="register">{t('tabs.createFamily')}</TabsTrigger>
            </TabsList>
          </Tabs>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t('fields.email')}</Label>
              <Input
                id="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{t('fields.password')}</Label>
              <Input
                id="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                required
              />
            </div>

            {mode === 'register' ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="family-name">{t('fields.familyName')}</Label>
                  <Input
                    id="family-name"
                    value={familyName}
                    onChange={(event) => setFamilyName(event.target.value)}
                    type="text"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="display-name">{t('fields.displayName')}</Label>
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    type="text"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="timezone">{t('fields.timezone')}</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="timezone" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {availableTimezones.map((option) => (
                          <SelectItem key={option} value={option}>
                            {formatTimezoneLabel(option)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="profile-color">{t('fields.profileColor')}</Label>
                  <Select value={colorKey} onValueChange={setColorKey}>
                    <SelectTrigger id="profile-color" className="w-full">
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
              </>
            ) : null}

            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('submit.saving') : mode === 'signin' ? t('submit.signIn') : t('submit.createFamily')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
