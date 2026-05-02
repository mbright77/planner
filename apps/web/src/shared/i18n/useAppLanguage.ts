import { useEffect } from 'react';

import i18n from './i18n';
import type { BootstrapResponse } from '../api/bootstrap';

const supportedLanguages = new Set(['en', 'sv']);

function normalizeLanguage(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const [baseLanguage] = normalized.split('-');
  if (!baseLanguage || !supportedLanguages.has(baseLanguage)) {
    return null;
  }

  return baseLanguage;
}

function resolvePreferredLanguage(data: BootstrapResponse | undefined): string {
  if (!data) {
    return 'en';
  }

  const currentUserProfile = data.profiles.find((profile) => profile.linkedUserId === data.membership.userId);
  const currentUserLanguage = normalizeLanguage(currentUserProfile?.preferredLanguage);
  if (currentUserLanguage) {
    return currentUserLanguage;
  }

  const adminMembership = data.memberships.find((membership) => membership.role === 'Admin');
  const adminProfile = data.profiles.find((profile) => profile.linkedUserId === adminMembership?.userId);
  const adminLanguage = normalizeLanguage(adminProfile?.preferredLanguage);
  if (adminLanguage) {
    return adminLanguage;
  }

  return 'en';
}

export function useAppLanguage(data: BootstrapResponse | undefined) {
  useEffect(() => {
    const preferredLanguage = resolvePreferredLanguage(data);
    if (i18n.resolvedLanguage === preferredLanguage) {
      return;
    }

    void i18n.changeLanguage(preferredLanguage);
  }, [data]);
}
