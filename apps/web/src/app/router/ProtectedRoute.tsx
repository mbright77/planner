import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuthSession } from '../../processes/auth-session/AuthSessionContext';

export function ProtectedRoute() {
  const { isHydrated, session } = useAuthSession();
  const location = useLocation();

  if (!isHydrated) {
    return null;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
