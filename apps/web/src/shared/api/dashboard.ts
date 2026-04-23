import { getDashboardOverview, type DashboardOverviewResponse } from '@planner/api-client';

import { env } from '../config/env';

export type { DashboardOverviewResponse };

export async function fetchDashboardOverview(accessToken: string, date?: string) {
  return getDashboardOverview({ baseUrl: env.apiBaseUrl, accessToken }, date);
}
