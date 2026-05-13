import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { LanguageCircleIcon, LinkSquare01Icon, Mail01Icon, UserIcon } from '@hugeicons/core-free-icons';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { Switch } from '@/components/ui/switch';
import { useCreateFamilyInvite, useFamilyInvites } from '../../entities/invite/model/useFamilyInvites';
import {
  useCreateProfile,
  useProfiles,
  useUpdateProfile,
} from '../../entities/profile/model/useProfiles';
import { useBootstrap } from '../../processes/family-bootstrap/useBootstrap';

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
    <section className="flex flex-col gap-4 py-4 md:gap-6">
      <Card>
        <CardHeader>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('eyebrow')}</p>
          <CardTitle className="text-2xl md:text-3xl">{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
          <div>
            <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" to="/settings/privacy">
              {t('privacyLink')}
            </Link>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HugeiconsIcon icon={UserIcon} aria-hidden="true" />
            {t('addMember')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="family-display-name">{t('fields.displayName')}</Label>
              <Input
                id="family-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={t('fields.displayNamePlaceholder')}
                type="text"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="family-color">{t('fields.colorKey')}</Label>
              <Select value={colorKey} onValueChange={setColorKey}>
                <SelectTrigger id="family-color" className="w-full">
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

            <Button type="submit" variant="outline" disabled={createProfileMutation.isPending}>
              {createProfileMutation.isPending ? t('saving') : t('addMember')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('invites.eyebrow')}</p>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HugeiconsIcon icon={LinkSquare01Icon} aria-hidden="true" />
              {t('invites.title')}
            </CardTitle>
            <CardDescription>{t('invites.description')}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form className="space-y-4" onSubmit={handleInvite}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="invite-email">{t('invites.email')}</Label>
                <Input
                  id="invite-email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder={t('invites.emailPlaceholder')}
                  type="email"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="invite-profile">{t('invites.linkProfileOptional')}</Label>
                <Select
                  value={inviteProfileId || '__none'}
                  onValueChange={(value) => setInviteProfileId(value === '__none' ? '' : value)}
                >
                  <SelectTrigger id="invite-profile" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="__none">{t('invites.newProfile')}</SelectItem>
                      {inviteableProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.displayName}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" variant="outline" disabled={createFamilyInviteMutation.isPending}>
                <HugeiconsIcon icon={Mail01Icon} data-icon="inline-start" aria-hidden="true" />
                {createFamilyInviteMutation.isPending ? t('invites.creating') : t('invites.createLink')}
              </Button>
            </form>

            <p className="text-sm text-muted-foreground">{t('invites.helper')}</p>

            {familyInvitesQuery.isLoading ? <p className="text-sm text-muted-foreground">{t('invites.loading')}</p> : null}
            {familyInvitesQuery.isError ? (
              <Alert variant="destructive">
                <AlertDescription>{t('invites.error')}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-3">
              {familyInvitesQuery.data?.map((invite) => {
                const inviteUrl = `${window.location.origin}/invite/${invite.token}`;

                return (
                  <article key={invite.id} className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-foreground">{invite.email}</p>
                      {invite.profileDisplayName ? (
                        <p className="text-sm text-muted-foreground">{t('invites.linkedTo', { name: invite.profileDisplayName })}</p>
                      ) : null}
                      <p className="text-sm text-muted-foreground">
                        {t('invites.expires', { date: new Date(invite.expiresAtUtc).toLocaleString() })}
                      </p>
                      <p className="break-all text-sm text-muted-foreground">{inviteUrl}</p>
                    </div>
                    <div className="mt-2">
                      <Badge variant={invite.isAccepted ? 'default' : 'secondary'}>
                        {invite.isAccepted ? t('invites.accepted') : t('invites.pending')}
                      </Badge>
                    </div>
                  </article>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {profilesQuery.isLoading ? <p className="text-sm text-muted-foreground">{t('loading')}</p> : null}
      {profilesQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{t('error')}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {profilesQuery.data?.map((profile, index) => (
          <Card key={profile.id} className={index === 0 ? 'ring-2 ring-primary/20' : undefined}>
            <CardHeader className="gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('profile.eyebrow')}</p>
                  <CardTitle className="text-lg">{profile.displayName}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{profile.isActive ? t('profile.activeMember') : t('profile.inactiveMember')}</Badge>
                    {index === 0 ? <Badge>{t('profile.activeBadge')}</Badge> : null}
                    <span className={getProfileColorChipClass(profile.colorKey)}>{t(`colors.${profile.colorKey}`)}</span>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-2">
                  <p className="text-xs text-muted-foreground uppercase">{t('stats.status')}</p>
                  <p className="text-sm font-medium">{profile.isActive ? t('stats.active') : t('stats.inactive')}</p>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <p className="text-xs text-muted-foreground uppercase">{t('stats.colorIdentity')}</p>
                  <p className="text-sm font-medium">{t(`colors.${profile.colorKey}`)}</p>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <p className="text-xs text-muted-foreground uppercase">{t('stats.signInAccess')}</p>
                  <p className="text-sm font-medium">{profile.hasLogin ? t('stats.hasLogin') : t('stats.profileOnly')}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-medium">{profile.isActive ? t('toggle.included') : t('toggle.hidden')}</p>
                  <p className="text-sm text-muted-foreground">
                    {profile.isActive ? t('toggle.includedHint') : t('toggle.hiddenHint')}
                  </p>
                </div>
                <Switch
                  checked={profile.isActive}
                  onCheckedChange={(nextChecked) =>
                    handleToggle(
                      profile.id,
                      nextChecked,
                      profile.displayName,
                      profile.colorKey,
                      profile.preferredLanguage,
                    )
                  }
                />
              </div>

              {profile.linkedUserId === currentUserId ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`language-${profile.id}`}>
                    <span className="inline-flex items-center gap-1">
                      <HugeiconsIcon icon={LanguageCircleIcon} aria-hidden="true" />
                      {t('preferredLanguage')}
                    </span>
                  </Label>
                  <Select
                    value={profile.preferredLanguage ?? 'en'}
                    onValueChange={(value) =>
                      handleLanguageChange(profile.id, value, profile.displayName, profile.colorKey, profile.isActive)
                    }
                    disabled={updateProfileMutation.isPending}
                  >
                    <SelectTrigger id={`language-${profile.id}`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {languageOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {t(`languages.${option}`)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
