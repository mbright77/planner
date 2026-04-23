import { useQuery } from '@tanstack/react-query';

import { fetchBootstrap } from '../../shared/api/bootstrap';
import { useAuthSession } from '../auth-session/AuthSessionContext';

export function useBootstrap() {
  const { session } = useAuthSession();

  return useQuery({
    queryKey: ['bootstrap', session?.accessToken],
    queryFn: () => fetchBootstrap(session!.accessToken),
    enabled: Boolean(session?.accessToken),
  });
}
