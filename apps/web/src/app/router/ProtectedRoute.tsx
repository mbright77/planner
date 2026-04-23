import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuthSession } from '../../processes/auth-session/AuthSessionContext';

export function ProtectedRoute() {
  const { session } = useAuthSession();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
