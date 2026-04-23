import {
  getBootstrap,
  seedDevelopmentUser as seedDevelopmentUserRequest,
  type BootstrapResponse,
  type DevelopmentSeedResponse,
} from '@planner/api-client';

import { env } from '../config/env';

export type { BootstrapResponse };

export async function fetchBootstrap(accessToken: string) {
  return getBootstrap({ baseUrl: env.apiBaseUrl, accessToken });
}

export async function seedDevelopmentUser(): Promise<DevelopmentSeedResponse> {
  return seedDevelopmentUserRequest({ baseUrl: env.apiBaseUrl });
}
