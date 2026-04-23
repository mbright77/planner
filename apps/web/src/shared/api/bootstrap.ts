import { http } from './http';

export type BootstrapResponse = {
  familyId: string;
  familyName: string;
  timezone: string;
  profiles: Array<{
    id: string;
    displayName: string;
    colorKey: string;
    isActive: boolean;
  }>;
  membership: {
    userId: string;
    email: string;
    role: string;
  };
};

export async function fetchBootstrap(accessToken: string) {
  return http<BootstrapResponse>('/api/v1/me/bootstrap', {
    method: 'GET',
    accessToken,
  });
}

export async function seedDevelopmentUser() {
  return http<{ email: string; password: string; seeded: boolean }>('/api/v1/dev/seed', {
    method: 'POST',
  });
}
