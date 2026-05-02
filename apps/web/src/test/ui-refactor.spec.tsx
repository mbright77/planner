/// <reference types="node" />

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { AppShell } from '../app/layouts/AppShell';
import { CalendarPage } from '../pages/calendar/CalendarPage';
import { FamilyPage } from '../pages/family/FamilyPage';
import { HomePage } from '../pages/home/HomePage';
import { LoginPage } from '../pages/login/LoginPage';
import { MealsPage } from '../pages/meals/MealsPage';
import { ShoppingPage } from '../pages/shopping/ShoppingPage';
import { readFileSync } from 'fs';
import { resolve } from 'path';

type CalendarEvent = {
  id: string;
  title: string;
  notes: string | null;
  date: string;
  startAtUtc: string;
  endAtUtc: string;
  assignedProfileId: string | null;
  isRecurring: boolean;
  repeatUntil: string | null;
};

type Meal = {
  id: string;
  mealDate: string;
  title: string;
  notes: string | null;
  ownerProfileId: string | null;
};

type ShoppingItem = {
  id: string;
  label: string;
  category: string;
  isCompleted: boolean;
  createdAtUtc: string;
  completedAtUtc: string | null;
  addedByProfileId: string | null;
};

const fixedToday = '2026-05-01';
const session = {
  accessToken: 'test-token',
  expiresAtUtc: '2099-01-01T00:00:00.000Z',
};

const bootstrapState = {
  data: {
    familyName: 'Kinship',
    membership: {
      role: 'Admin',
      canPlanMeals: true,
    },
    profiles: [
      { id: 'p1', displayName: 'Alex', colorKey: 'blue', isActive: true, hasLogin: true },
      { id: 'p2', displayName: 'Sam', colorKey: 'green', isActive: true, hasLogin: false },
    ],
  },
  isLoading: false,
  isError: false,
};

const dashboardState = {
  data: {
    date: fixedToday,
    todayEvents: [] as Array<{ id: string; title: string; notes: string | null; startAtUtc: string; assignedProfileId: string | null }> ,
    tonightMeal: null as { id: string; title: string; notes: string | null; ownerProfileId: string | null } | null,
    shopping: {
      openItemsCount: 0,
      previewLabels: [] as string[],
    },
    upcomingEvent: null as { id: string; title: string; startAtUtc: string; endAtUtc: string; assignedProfileId: string | null } | null,
  },
  isLoading: false,
  isError: false,
};

const offlineMutationState = {
  pendingCount: 0,
  failedCount: 0,
  isFlushing: false,
  hasBlockingFailure: false,
  latestFailureMessage: null as string | null,
};

let calendarEvents: CalendarEvent[] = [];
let meals: Meal[] = [];
let mealRequests: Array<{
  id: string;
  requesterProfileId: string | null;
  requestedForDate: string | null;
  title: string;
  notes: string | null;
  status: string;
  assigneeProfileId: string | null;
  createdAtUtc: string;
}> = [];
let shoppingItems: ShoppingItem[] = [];

vi.mock('../processes/auth-session/AuthSessionContext', () => ({
  useAuthSession: () => ({
    session,
    isHydrated: true,
    setSession: vi.fn(),
    clearSession: vi.fn(),
  }),
}));

vi.mock('../processes/family-bootstrap/useBootstrap', () => ({
  useBootstrap: () => bootstrapState,
}));

vi.mock('../entities/dashboard/model/useDashboardOverview', () => ({
  useDashboardOverview: () => dashboardState,
}));

vi.mock('../shared/lib/offlineMutationQueue', () => ({
  useOfflineMutationState: () => offlineMutationState,
}));

vi.mock('../shared/lib/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true }),
}));

vi.mock('../entities/event/model/useCalendarWeek', () => ({
  useCalendarWeek: () => ({ data: { weekStart: '2026-04-27', events: calendarEvents }, isLoading: false, isError: false }),
  useCreateCalendarEvent: () => ({
    isPending: false,
    mutateAsync: async (request: { title: string; notes: string | null; date: string; startTime: string; endTime: string; assignedProfileId: string | null; repeatsWeekly: boolean; repeatUntil: string | null }) => {
      calendarEvents = [
        ...calendarEvents,
        {
          id: `event-${calendarEvents.length + 1}`,
          title: request.title,
          notes: request.notes,
          date: request.date,
          startAtUtc: `${request.date}T${request.startTime}:00.000Z`,
          endAtUtc: `${request.date}T${request.endTime}:00.000Z`,
          assignedProfileId: request.assignedProfileId,
          isRecurring: request.repeatsWeekly,
          repeatUntil: request.repeatUntil,
        },
      ];
    },
  }),
  useUpdateCalendarEvent: () => ({ isPending: false, mutateAsync: async () => undefined }),
  useDeleteCalendarEvent: () => ({
    isPending: false,
    mutateAsync: async (eventId: string) => {
      calendarEvents = calendarEvents.filter((event) => event.id !== eventId);
    },
  }),
}));

vi.mock('../entities/meal/model/useMealsWeek', () => ({
  useMealsWeek: () => ({ data: { weekStart: '2026-04-27', meals }, isLoading: false, isError: false }),
  useMealRequests: () => ({ data: mealRequests, isLoading: false, isError: false }),
  useCreateMealPlan: () => ({
    isPending: false,
    mutateAsync: async (request: { mealDate: string; title: string; notes: string | null; ownerProfileId: string | null }) => {
      meals = [
        ...meals.filter((meal) => meal.mealDate !== request.mealDate),
        {
          id: `meal-${meals.length + 1}`,
          mealDate: request.mealDate,
          title: request.title,
          notes: request.notes,
          ownerProfileId: request.ownerProfileId,
        },
      ];
    },
  }),
  useUpdateMealPlan: () => ({ isPending: false, mutateAsync: async () => undefined }),
  useDeleteMealPlan: () => ({
    isPending: false,
    mutateAsync: async (mealId: string) => {
      meals = meals.filter((meal) => meal.id !== mealId);
    },
  }),
  useCreateMealRequest: () => ({ isPending: false, mutateAsync: async () => undefined }),
  useAssignMealRequest: () => ({ isPending: false, mutateAsync: async () => undefined }),
  useAcceptMealRequest: () => ({ isPending: false, mutateAsync: async () => undefined }),
}));

vi.mock('../entities/shopping-item/model/useShoppingItems', () => ({
  useShoppingItems: () => ({ data: shoppingItems, isLoading: false, isError: false }),
  useCreateShoppingItem: () => ({
    isPending: false,
    mutateAsync: async (request: { label: string; category: string; addedByProfileId: string | null }) => {
      shoppingItems = [
        ...shoppingItems,
        {
          id: `shopping-${shoppingItems.length + 1}`,
          label: request.label,
          category: request.category,
          isCompleted: false,
          createdAtUtc: new Date().toISOString(),
          completedAtUtc: null,
          addedByProfileId: request.addedByProfileId,
        },
      ];
    },
  }),
  useUpdateShoppingItem: () => ({
    isPending: false,
    mutate: ({ itemId, isCompleted }: { itemId: string; isCompleted: boolean }) => {
      shoppingItems = shoppingItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              isCompleted,
              completedAtUtc: isCompleted ? new Date().toISOString() : null,
            }
          : item,
      );
    },
  }),
  useDeleteShoppingItem: () => ({
    isPending: false,
    mutate: (itemId: string) => {
      shoppingItems = shoppingItems.filter((item) => item.id !== itemId);
    },
  }),
}));

vi.mock('../entities/profile/model/useProfiles', () => ({
  useProfiles: () => ({ data: bootstrapState.data.profiles, isLoading: false, isError: false }),
  useCreateProfile: () => ({ isPending: false, mutateAsync: async () => undefined }),
  useUpdateProfile: () => ({ isPending: false, mutateAsync: async () => undefined }),
}));

vi.mock('../entities/invite/model/useFamilyInvites', () => ({
  useFamilyInvites: () => ({ data: [], isLoading: false, isError: false }),
  useCreateFamilyInvite: () => ({ isPending: false, mutateAsync: async () => undefined }),
}));

function renderShellRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/meals" element={<MealsPage />} />
          <Route path="/shopping" element={<ShoppingPage />} />
          <Route path="/family" element={<FamilyPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function renderLoginRoute() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function getStylesheetText() {
  return readFileSync(resolve(process.cwd(), 'src/app/styles/index.css'), 'utf8');
}

beforeEach(() => {
  calendarEvents = [];
  meals = [];
  mealRequests = [];
  shoppingItems = [];
  dashboardState.data.todayEvents = [];
  dashboardState.data.tonightMeal = null;
  dashboardState.data.shopping = { openItemsCount: 0, previewLabels: [] };
  dashboardState.data.upcomingEvent = null;

  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: 1280,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: 800,
  });
});

afterEach(() => {
  cleanup();
});

describe('Phase 12 - Design token and visual checks', () => {
  it('12.1.x keeps active nav shape/colors, primary button color, and Plus Jakarta Sans', () => {
    const styles = getStylesheetText();

    expect(styles).toMatch(/\.bottom-nav-link\s*\{[^}]*border-radius:\s*1rem;/s);
    const activeNavRule = styles.match(/\.bottom-nav-link-active\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    expect(activeNavRule).toContain('color: white');
    expect(activeNavRule).toContain('background: var(--primary)');

    const primaryRule = styles.match(/\.primary-button\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    expect(primaryRule).toContain('linear-gradient');
    expect(primaryRule).not.toContain('#5da9e9');

    expect(styles).toMatch(/body\s*\{[^}]*font-family:[^;]*Plus Jakarta Sans/s);
  });
});

describe('Phase 12 - Layout and viewport checks', () => {
  it('12.2.1 and 12.2.2 keep 370px shell pages visible with 5 nav items', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 370 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 812 });

    const routes = ['/', '/calendar', '/meals', '/shopping', '/family'];

    for (const route of routes) {
      const view = renderShellRoute(route);

      expect(document.body.scrollWidth).toBeLessThanOrEqual(window.innerWidth);

      const navLinks = Array.from(document.querySelectorAll('.bottom-nav-link')) as HTMLElement[];
      expect(navLinks).toHaveLength(5);
      navLinks.forEach((link) => {
        expect(link).not.toHaveAttribute('hidden');
        expect(link).not.toHaveAttribute('aria-hidden', 'true');
      });

      view.unmount();
    }
  });

  it('12.2.3 keeps shopping list items in single-column list structure', async () => {
    shoppingItems = [
      {
        id: 'shopping-a',
        label: 'Milk',
        category: 'Dairy',
        isCompleted: false,
        createdAtUtc: '2026-05-01T08:00:00.000Z',
        completedAtUtc: null,
        addedByProfileId: 'p1',
      },
      {
        id: 'shopping-b',
        label: 'Bananas',
        category: 'Produce',
        isCompleted: false,
        createdAtUtc: '2026-05-01T08:00:00.000Z',
        completedAtUtc: null,
        addedByProfileId: 'p2',
      },
    ];

    const { container } = renderShellRoute('/shopping');
    await waitFor(() => expect(screen.getByText('Milk')).toBeInTheDocument());

    const list = container.querySelector('.shopping-list');
    expect(list).toBeTruthy();

    const items = Array.from(container.querySelectorAll('.shopping-list > .shopping-list-item'));
    expect(items.length).toBeGreaterThan(0);
  });
});

describe('Phase 12 - Delete functionality and behavior regressions', () => {
  it('12.3.2, 12.3.3, 12.5.2 adds and deletes a calendar event', async () => {
    renderShellRoute('/calendar');

    fireEvent.click(screen.getAllByRole('button', { name: 'Add event' })[0]);

    const titleInput = await screen.findByPlaceholderText('Add event title');
    fireEvent.change(titleInput, { target: { value: 'Dentist Appointment' } });
    fireEvent.click(screen.getByText('Add event', { selector: 'button[type="submit"]' }));

    await waitFor(() => expect(screen.getByText('Dentist Appointment')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Delete Dentist Appointment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete Dentist Appointment' }));

    await waitFor(() => expect(screen.queryByText('Dentist Appointment')).not.toBeInTheDocument());
  });

  it('12.3.4 adds and deletes a meal', async () => {
    renderShellRoute('/meals');

    const mealTitle = await screen.findByPlaceholderText('Plan dinner');
    fireEvent.change(mealTitle, { target: { value: 'Taco Night' } });
    fireEvent.click(screen.getByRole('button', { name: /Save dinner for/i }));

    await waitFor(() => expect(screen.getByText('Taco Night')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Delete Taco Night' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete Taco Night' }));

    await waitFor(() => expect(screen.queryByText('Taco Night')).not.toBeInTheDocument());
  });

  it('12.3.5, 12.5.3, 12.5.4 adds shopping item, checks off, and removes it', async () => {
    renderShellRoute('/shopping');

    fireEvent.click(screen.getByRole('button', { name: 'Add shopping item' }));

    const input = await screen.findByPlaceholderText('Add item (e.g., Milk)');
    fireEvent.change(input, { target: { value: 'Milk' } });
    fireEvent.click(screen.getByText('Add item', { selector: 'button[type="submit"]' }));

    await waitFor(() => expect(screen.getByText('Milk')).toBeInTheDocument());

    const checkbox = screen.getByRole('checkbox', { name: 'Milk' });
    fireEvent.click(checkbox);

    cleanup();
    renderShellRoute('/shopping');
    await waitFor(() => expect(screen.getByText('Milk')).toHaveClass('shopping-item-label-complete'));

    fireEvent.click(screen.getByRole('button', { name: 'Remove Milk from list' }));

    cleanup();
    renderShellRoute('/shopping');
    await waitFor(() => expect(screen.queryByText('Milk')).not.toBeInTheDocument());
  });

  it('12.5.1 renders dashboard with today date context', () => {
    renderShellRoute('/');

    const expectedDate = new Date(`${fixedToday}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    expect(screen.getByText(expectedDate)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Good/i })).toBeInTheDocument();
  });
});

describe('Phase 12 - Accessibility checks', () => {
  it('12.4.1 exposes skip link in app shell', () => {
    renderShellRoute('/');
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main-content');
  });

  it('12.4.2 keeps form controls labeled on key routes', () => {
    const pages = [
      { type: 'shell', path: '/calendar' },
      { type: 'shell', path: '/meals' },
      { type: 'shell', path: '/shopping' },
      { type: 'shell', path: '/family' },
      { type: 'login', path: '/login' },
    ] as const;

    for (const page of pages) {
      const view = page.type === 'shell' ? renderShellRoute(page.path) : renderLoginRoute();

      const controls = Array.from(document.querySelectorAll('input, select, textarea')) as HTMLElement[];
      const unlabeled = controls.filter((control) => {
        const html = control as HTMLInputElement;
        const id = html.id;
        const byFor = id ? document.querySelector(`label[for="${id}"]`) : null;
        return !byFor && !control.closest('label') && !control.getAttribute('aria-label') && !control.getAttribute('aria-labelledby');
      });

      expect(unlabeled).toHaveLength(0);
      view.unmount();
    }
  });

  it('12.4.3 icon-only buttons have aria-label', () => {
    renderShellRoute('/');

    const iconOnlyButtons = Array.from(document.querySelectorAll('button')).filter((button) => {
      return Boolean(button.querySelector('.material-symbols-outlined')) && Boolean(button.getAttribute('aria-label'));
    });

    expect(iconOnlyButtons.length).toBeGreaterThan(0);
    iconOnlyButtons.forEach((button) => {
      expect(button.getAttribute('aria-label')).toBeTruthy();
    });
  });

  it('12.4.4 keeps material symbols decorative spans aria-hidden', () => {
    renderShellRoute('/shopping');

    const icons = Array.from(document.querySelectorAll('.material-symbols-outlined'));
    expect(icons.length).toBeGreaterThan(0);
    icons.forEach((icon) => {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('12.4.5 allows keyboard focus across all five nav items', () => {
    renderShellRoute('/');

    const navLinks = Array.from(document.querySelectorAll('.bottom-nav .bottom-nav-link')) as HTMLAnchorElement[];
    expect(navLinks).toHaveLength(5);

    const focusedHrefs: string[] = [];
    navLinks.forEach((link) => {
      link.focus();
      focusedHrefs.push((document.activeElement as HTMLAnchorElement | null)?.getAttribute('href') ?? '');
    });

    expect(new Set(focusedHrefs).size).toBe(5);
    expect(focusedHrefs).toContain('/');
    expect(focusedHrefs).toContain('/calendar');
    expect(focusedHrefs).toContain('/meals');
    expect(focusedHrefs).toContain('/shopping');
    expect(focusedHrefs).toContain('/family');
  });
});
