import { useQuery } from '@tanstack/react-query';

import { fetchDashboardOverview } from '../../../shared/api/dashboard';
import { useAuthSession } from '../../../processes/auth-session/AuthSessionContext';

export function useDashboardOverview(date?: string) {
  const { session } = useAuthSession();

  return useQuery({
    queryKey: ['dashboard-overview', session?.accessToken, date],
    queryFn: () => fetchDashboardOverview(session!.accessToken, date),
    enabled: Boolean(session?.accessToken),
  });
}
