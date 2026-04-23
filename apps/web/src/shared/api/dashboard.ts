import { http } from './http';

export type DashboardOverviewResponse = {
  date: string;
  weekStart: string;
  weekEnd: string;
  week: Array<{
    date: string;
    eventCount: number;
    hasMeal: boolean;
  }>;
  todayEvents: Array<{
    id: string;
    title: string;
    notes: string | null;
    startAtUtc: string;
    endAtUtc: string;
    assignedProfileId: string | null;
    isPast: boolean;
  }>;
  tonightMeal: {
    id: string;
    title: string;
    notes: string | null;
    ownerProfileId: string | null;
  } | null;
  shopping: {
    openItemsCount: number;
    previewLabels: string[];
  };
  upcomingEvent: {
    id: string;
    title: string;
    startAtUtc: string;
    endAtUtc: string;
    assignedProfileId: string | null;
  } | null;
};

export async function fetchDashboardOverview(accessToken: string, date?: string) {
  const search = date ? `?date=${date}` : '';

  return http<DashboardOverviewResponse>(`/api/v1/dashboard/overview${search}`, {
    method: 'GET',
    accessToken,
  });
}
