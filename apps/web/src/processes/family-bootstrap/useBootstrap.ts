import { fetchBootstrap } from '../../shared/api/bootstrap';
import { useOfflineQuery } from '../../shared/lib/useOfflineQuery';
import { useAuthSession } from '../auth-session/AuthSessionContext';

export function useBootstrap() {
  const { session } = useAuthSession();

  return useOfflineQuery({
    queryKey: ['bootstrap', session?.accessToken],
    queryFn: () => fetchBootstrap(session!.accessToken),
    enabled: Boolean(session?.accessToken),
  });
}
