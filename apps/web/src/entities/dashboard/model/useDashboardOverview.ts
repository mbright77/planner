import { fetchDashboardOverview } from '../../../shared/api/dashboard';
import { useAuthSession } from '../../../processes/auth-session/AuthSessionContext';
import { useOfflineQuery } from '../../../shared/lib/useOfflineQuery';

export function useDashboardOverview(date?: string) {
  const { session } = useAuthSession();

  return useOfflineQuery({
    queryKey: ['dashboard-overview', session?.accessToken, date],
    queryFn: () => fetchDashboardOverview(session!.accessToken, date),
    enabled: Boolean(session?.accessToken),
  });
}
