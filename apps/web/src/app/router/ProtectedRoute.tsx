import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuthSession } from '../../processes/auth-session/AuthSessionContext';
import { useNetworkStatus } from '../../shared/lib/useNetworkStatus';

export function ProtectedRoute() {
  const { isHydrated, isExpired, session } = useAuthSession();
  const { isOnline } = useNetworkStatus();
  const location = useLocation();

  if (!isHydrated) {
    return null;
  }

  if (!session || (isOnline && isExpired)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
