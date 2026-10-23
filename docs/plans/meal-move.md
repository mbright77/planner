# Plan: Move meal to another date

## Use case
A user planned meals in the wrong week and wants to move them one at a time to another date.
A "Move meal" button opens a date picker; on **OK** the meal moves, and a toast shows
"Meal moved" or "Meal not moved".

## Current state (findings)

- **Backend already supports moving.** `PUT /api/v1/meals/{mealId}` (`MealEndpoints.UpdateMealAsync`)
  takes `UpdateMealPlanRequest` including `MealDate`, enforces family scope from DB membership,
  and returns `409 Conflict` if another meal already exists on the target date
  (one meal per family per day). No new endpoint, contract or migration is needed.
- **Frontend hook already handles cross-week dates.** `useUpdateMealPlan(weekStart)` in
  `apps/web/src/entities/meal/model/useMealsWeek.ts` removes the meal from the current week cache
  when the new date is outside the week, rolls back on error, and invalidates the target week's
  cache (`computeWeekStartFromDate`) plus `dashboard-overview`. It is offline-queue aware (`meal.update`).
- **Edit form always sends `mealDate: selectedDate`** (`MealsPage.tsx` `handleSaveMealEdit`), so there is
  no way to change the date today.
- **No toast system exists** (no sonner / toast component in `src/components/ui`).
- **No calendar/date picker component exists.** `Dialog` and `Drawer` exist in `src/components/ui`.

## Implementation steps

### 1. Toast infrastructure
- Add `sonner` (shadcn's toast) → `src/components/ui/sonner.tsx` styled with DESIGN.md tokens.
- Mount `<Toaster position="top-center" />` once in `AppShell.tsx` (mobile-first, clear of bottom nav).

### 2. Date picker: reuse the week strip
Decision: reuse the Meals page's own 7-day week strip (Previous/Next + day buttons with ✓ for
days that have a meal) inside a `Drawer`. It matches the existing visual language exactly,
follows theme tokens, needs no new dependency, and fits the "move to next week" case
(one tap on Next, one on the day). Native `<input type="date">` (OS-styled, clashes with dark
theme) and shadcn `Calendar` (new dep, month grid not used elsewhere) were rejected.

**2a. Extract `WeekDayPicker`** — `src/features/meals/WeekDayPicker.tsx`
- Move the strip markup from `MealsPage.tsx` (Previous/Next buttons + `grid-cols-7` day buttons).
- Props: `weekStart`, `selectedDate`, `onSelect(date)`, `onShiftWeek(-1 | 1)`,
  `mealsByDate: Map<string, MealPlanResponse>`, optional `requestsByDate`,
  optional `isDayDisabled(date) => boolean`, `locale`.
- Move `shiftWeekDate` / week-day building helpers alongside it (or into `entities/meal/lib`).
- `MealsPage` uses it with no visual change (refactor-only step; existing UI tests must pass).

**2b. `MoveMealDrawer`** — `src/features/meals/MoveMealDrawer.tsx`
- Props: `meal`, `open`, `onOpenChange`, `onConfirm(newDate)`, `isPending`.
- Local state `pickerWeekStart`, `pickerDate`; on open, initialise to the meal's week **+ 1**
  with the same weekday selected (common case = just press OK).
- Loads the shown week via `useMealsWeek(pickerWeekStart)` to feed `mealsByDate`.
- Days that already have a (different) meal are disabled (`isDayDisabled`), so conflicts
  are prevented up front; the meal's own current date is also disabled.
- Header shows the meal title and the chosen date (`formatLongDate`); footer Cancel / OK.
- OK disabled while `isPending`, when no date is chosen, or the chosen date is occupied.
- Offline: the picker week may be uncached → strip still renders, just without ✓ marks;
  server 409 remains the safety net.

### 3. Wire into `MealsPage.tsx`
- Add a "Move meal" button next to Edit/Delete in the selected-meal card (only when `selectedMeal`
  exists and the user can plan meals).
- `handleMoveMeal(newDate)` calls `updateMealPlanMutation.mutateAsync` with the meal's existing
  `title/notes/recipeUrl/ownerProfileId` and `mealDate: newDate`.
- Result handling:
  - `status === 'ok'` → `toast.success(t('move.success'))` ("Meal moved"), close drawer.
  - `status === 'queued'` (offline) → treat as moved (optimistic) — toast "Meal moved" (or a
    "will sync when online" variant).
  - error (409 conflict, 404, network) → `toast.error(t('move.failed'))` ("Meal not moved");
    for 409 optionally add description "A meal is already planned for that day".
- Keep the selected day where it is (the user moves meals one at a time from the wrong week).

### 4. i18n
Add keys to `locales/en/meals.json` and `locales/sv/meals.json`:
`moveMeal`, `move.title`, `move.newDate`, `move.ok`, `move.cancel`, `move.success`,
`move.failed`, `move.conflict`.

### 5. Tests
- **API** (`CoreFlowsApiTests.cs`): PUT with a new date in the next week → 200 and meal appears
  in that week's `GET /week`; PUT onto an occupied date → 409 (likely partly covered already — verify).
- **Web** (`useMealsWeek.test.ts`): updating to a date outside the week removes it from the
  current week cache and invalidates the target week.
- **Web**: `WeekDayPicker` test — renders 7 days, ✓ for meal days, disabled days not clickable,
  Next/Previous call `onShiftWeek`.
- **Web UI**: MealsPage test — open Move, pick date, OK → mutation called with new date and
  success toast; mocked 409 → "Meal not moved" toast.

### 6. Verify
```
pnpm --filter @planner/web build
dotnet build planner.sln
dotnet test planner.sln
```
Manual: move a meal to next week, navigate forward, confirm it's there; try moving onto an
occupied day; try offline.

## Open decisions
1. ~~Date picker type~~ — decided: reused week strip in a Drawer.
2. Conflict behaviour: fail with "Meal not moved" (current backend) vs. offer swap/overwrite.
3. Offline: show "Meal moved" immediately, or a distinct "queued" toast.
4. Bootstrap: confirm whether bootstrap exposes meals (AGENTS.md rule); if so, invalidate it too.
