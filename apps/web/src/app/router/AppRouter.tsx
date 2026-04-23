import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '../layouts/AppShell';
import { ProtectedRoute } from './ProtectedRoute';
import { CalendarPage } from '../../pages/calendar/CalendarPage';
import { FamilyPage } from '../../pages/family/FamilyPage';
import { HomePage } from '../../pages/home/HomePage';
import { InvitePage } from '../../pages/invite/InvitePage';
import { LoginPage } from '../../pages/login/LoginPage';
import { MealsPage } from '../../pages/meals/MealsPage';
import { ShoppingPage } from '../../pages/shopping/ShoppingPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/meals" element={<MealsPage />} />
          <Route path="/shopping" element={<ShoppingPage />} />
          <Route path="/family" element={<FamilyPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
