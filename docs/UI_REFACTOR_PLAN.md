# Vibrant UI Refactor Plan

## Overview

This document is the authoritative plan for refactoring the Family Planner frontend from the current "Kinship UI" (soft blues, subdued palette) to the "Vibrant Family Connection" design system (bold coral/rose, sunshine yellow, deep teal accents). All behavior, routing, and backend integration remain unchanged. This is a **visual and structural CSS refactor only** — no backend changes required.

---

## Design System Mapping

### New Color Palette (CSS Custom Properties)

| Token | Current Value | New Value |
|---|---|---|
| `--background` | `#f9f9f7` | `#f4fafd` |
| `--surface` | `#ffffff` | `#ffffff` |
| `--surface-subtle` | `#f1f3f9` | `#e8eff1` |
| `--text` | `#181c20` | `#161d1f` |
| `--text-muted` | `#5f6872` | `#8d706e` |
| `--border` | `#edf1f5` | `#ffd4d2` (rose-50 tint) |
| `--primary` | `#5da9e9` (sky blue) | `#b3272c` (coral/rose) |
| `--primary-strong` | `#00639a` | `#b3272c` |
| `--primary-container` | _(new)_ | `#ff5f5d` |
| `--secondary` | _(soft coral)_ | `#735c00` |
| `--secondary-container` | _(new)_ | `#fdd022` (sunshine yellow) |
| `--tertiary` | _(soft green)_ | `#006a65` (deep teal) |
| `--tertiary-container` | _(new)_ | `#0da79f` |
| `--shadow` | `rgba(45,49,50,0.05)` | `rgba(255,95,93,0.08)` |
| `--shadow-floating` | `rgba(45,49,50,0.10)` | `rgba(255,95,93,0.25)` |

### Typography

- **Headlines**: `Plus Jakarta Sans` (800/700 weight) — already partially used
- **Body/UI**: `Plus Jakarta Sans` replaces `Public Sans` app-wide
- New type scale: `display-lg` (48px/800), `headline-lg` (32px/700), `headline-md` (24px/700), `body-lg` (18px/500), `body-md` (16px/400), `label-bold` (14px/700)

### Shape Language

- Cards: `border-radius: 2rem` (32px) — increase from current `1.25rem`
- Buttons/inputs: `border-radius: 1rem` (16px) — increase from current `0.75rem`
- Bottom nav active pill: `border-radius: 1rem` with coral gradient
- Profile avatars: `border-radius: 999px` with 4px colored border

### Icons

- Replace current inline SVGs in `AppShell` with **Material Symbols Outlined** font icons
- Add Google Fonts link for `Material+Symbols+Outlined`

---

## Page Mapping: Current → New Design

### 1. App Shell (`AppShell.tsx`)

**Current:** Sticky top bar (family name + avatar + sign-out), fixed bottom nav with 5 SVG icons.  
**New:**
- Header: white/90 backdrop, rose-50 bottom border, `box-shadow: 0 4px 20px rgba(255,95,93,0.1)`, user avatar circle with 2px coral border, "Hello, Fam!" in coral, notification bell icon button.
- Bottom nav: `rounded-t-[32px]`, rose-50 top border, active item gets coral pill background with white text and scale-110 + shadow treatment.
- Inactive items: `text-slate-400`, hover → rose-400.
- Skip link preserved for accessibility.

### 2. Home Dashboard (`HomePage.tsx`)

**Current:** Hero section, 7-day week strip with dots, timeline list, dinner card, mini grocery/upcoming cards.  
**New design maps as:**
- **REMOVE:** Week strip — home page no longer shows a date strip
- **REMOVE:** Dinner tonight card — not shown on home page
- **REMOVE:** Grocery mini card — not shown on home page
- **KEEP:** "Today's Fun" / today's events timeline — this is the sole content of the page body. Render today's calendar events as a vertical timeline list. Each item shows time (HH:MM + AM/PM), event title, and member names. Style with `border-l-4` left-colored border and `rounded-2xl` card per event, matching the vibrant design's event row layout.
- **SKIP:** "Family Challenge" progress bar section
- **SKIP:** "Quick Tasks" / chore checklist
- If there are no events today, show a friendly empty state ("Nothing planned today — enjoy the day!").
- Home page remains **read-only** — no add or delete buttons on event items here.

### 3. Calendar Page (`CalendarPage.tsx`)

**Current:** Week strip pills, "Add Event" form card (inline), day cards with event items.  
**New design maps as:**
- Week strip: large cards (w-16 h-24), gradient active state (coral→rose), scale-105
- Event items: `border-l-[12px]` thick colored left border, rounded-[28px], category chip, member avatar stack
- **ADD:** Delete button on each event (currently missing per requirements)
- FAB: gradient coral→orange, rounded-[24px], shadow-rose-200

### 4. Meals Page (`MealsPage.tsx`)

**Current:** Meals range title, week strip, compose form card, meal cards per day, meal requests section.  
**New design maps as:**
- Bento grid layout for current day (breakfast/lunch small squares, dinner large featured card with coral gradient background)
- Weekly view: keep but update card style to match vibrant cards
- Meal requests → "Family Requests" section, request cards with icon avatar + add button
- **ADD:** Delete button on each meal card (currently missing per requirements)
- **SKIP:** "Grocery List Quick Look" inline section within Meals (already a separate Shopping page)

### 5. Shopping Page (`ShoppingPage.tsx`)

**Current:** Quick-add form card, shopping groups with item lists and checkboxes.  
**New design maps as:**
- Section headers: large pill header with left-8 colored border and category icon + item count badge
- Item cards: individual white rounded-2xl cards (floating list items) with 48px icon square and custom checkbox
- Checkbox: `h-8 w-8 rounded-xl border-2 border-tertiary-container` with check icon overlay
- **ADD:** Delete button per item (currently missing per requirements)
- **SKIP:** "Family Goal / Healthy Snacks Challenge" progress section

### 6. Family / Profiles Page (`FamilyPage.tsx`)

**Current:** Profile cards with color bar, stats grid, invite panel.  
**New design maps as:**
- Bento grid: active profile = col-span-2 large card with photo slot (or initial), smaller cards for other members
- Profile cards: `rounded-[32px]`, `border-2 border-primary-container`, profile color as border tint
- **SKIP:** Level/XP progress bars within profile cards
- Color picker for profile color: replace text select with visual color button grid
- Add new member button: dashed border card with + icon

### 7. Login / Auth Pages (`LoginPage.tsx`)

**Current:** Simple toggle (login/register), form fields, primary button.  
**New design maps as:**
- Same structure, update to new color tokens (coral primary, rounded-2xl inputs, gradient button)
- Focus styles: yellow border on focus (`border-secondary-container`)

### 8. Mobile Sheet (modals for add/edit forms)

**Current:** `mobile-sheet` bottom sheet with form.  
**New:** Keep same behavior, update visual: `rounded-t-[32px]`, thicker border, rose shadow

---

## What to KEEP (Behavioral)

- All routing and nav structure
- All TanStack Query hooks and API calls
- All form logic (useState)
- All accessibility infrastructure: skip link, ARIA labels, `role` attributes, `focus-visible` outlines
- Offline status banners
- Bootstrap data loading
- Auth session management

## What to ADD (new functionality required)

- **Delete calendar events** — API endpoint exists (`DELETE /api/v1/calendar/{id}`), needs delete button in UI
- **Delete meals** — API endpoint exists (`DELETE /api/v1/meals/{id}`), needs delete button in UI  
- **Delete shopping items** — API endpoint exists (`DELETE /api/v1/shopping/{id}`), needs delete button in UI
- All delete buttons must have accessible labels, confirmation where appropriate (e.g., inline confirmation or destructive button pattern)

## What to SKIP (from new design)

- Family Challenge / Goal progress bar (home page)
- Family Chore Goal progress (calendar page)
- Level/XP system on profiles
- "Quick Tasks" chore checklist (home page)
- Photo/image upload for profiles (current uses initials)
- "Don't Forget" accent promo card (shopping)

---

## Risks

### High Risk
1. **CSS variable cascade collision** — Changing `--primary` from blue to coral affects every single component simultaneously. Must audit all usages before switching.
2. **Accessibility regression on color change** — The new coral/rose primary (`#b3272c`) must maintain 4.5:1 contrast ratio on white backgrounds. Need to verify WCAG AA compliance for all text/button combinations before committing.
3. **370px viewport breakage** — New designs use 32px side padding (`px-container-margin`). At 370px viewport, this leaves only 306px of content width. Cards with `grid-cols-2` will break. Every two-column grid must have a single-column fallback below ~440px.

### Medium Risk
4. **Material Symbols font loading** — Adding Google Fonts for icon font introduces a network dependency. Must add fallback (current SVG icons) or inline critical icon paths. Also adds ~200KB to initial load.
5. **Bottom nav height change** — New nav is `h-24 pb-6` (taller). The `floating-action-button` and `app-content` padding-bottom must be updated to avoid overlap.
6. **Bento grid aspect-ratio cards** — `aspect-square` cards on meal/dashboard will collapse or overflow on very small screens. Need to disable aspect-ratio below 400px.
7. **Input focus styles** — New design uses yellow border on focus (`border-secondary-container`). Current `:focus-visible` uses `outline` instead. Inputs need custom focus style without removing accessibility.

### Low Risk
8. **Font swap visual flash** — Switching body font from `Public Sans` to `Plus Jakarta Sans` will cause a brief FOUT (flash of unstyled text) on first load if font is not preloaded.
9. **Profile color chips** — Current `profile-color-chip` uses hardcoded blue. Must ensure per-member color is reflected as tinted background (already partially implemented via CSS classes like `.profile-card-green`).
10. **Delete confirmation UX** — Adding delete buttons to calendar/meals/shopping requires a pattern. Must use inline destructive confirmation (not browser `confirm()`) to remain accessible.
11. **Home page event data source** — Home page now needs to fetch today's calendar events independently (or re-use the existing calendar query scoped to today). If the calendar query requires a selected week, a separate query for "today only" may be needed to avoid loading a full week just for the home page.
12. **Calendar dot data requirement** — Week strip dots require knowing which days have events. The week events response already returns all events for the week; pass a derived `eventsByDate` count map into the week strip component. No extra API call needed, but the week strip component signature must be extended.

---

## Implementation Plan

---

### Phase 1 — Foundation & Design Tokens

**Goal:** Establish the new CSS variables, fonts, and base visual layer without breaking existing layout.

- [ ] **1.1** Add `Plus Jakarta Sans` (weights 400, 500, 700, 800) and `Material Symbols Outlined` to the HTML `<head>` in `index.html`.
- [ ] **1.2** Add font preload link tags for `Plus Jakarta Sans` to reduce FOUT.
- [ ] **1.3** Update CSS custom properties in `:root` block of `index.css`:
  - Change `--background`, `--surface`, `--surface-subtle`, `--text`, `--text-muted`, `--border`
  - Change `--primary` to `#b3272c`, `--primary-strong` to `#b3272c`
  - Add `--primary-container: #ff5f5d`, `--secondary-container: #fdd022`, `--tertiary: #006a65`, `--tertiary-container: #0da79f`
  - Add `--on-surface-variant: #5a413f`, `--outline: #8d706e`
  - Update `--shadow` and `--shadow-floating` to rose-tinted values
- [ ] **1.4** Change body `font-family` to `'Plus Jakarta Sans', system-ui, ...` throughout.
- [ ] **1.5** Update `:focus-visible` outline to use `--primary` (now coral) — verify 3:1+ contrast on common backgrounds.
- [ ] **1.6** Verify no build errors: `pnpm --filter @planner/web build`.
- [ ] **1.7** Run accessibility contrast check on new `--primary` (#b3272c) vs white: must be ≥ 4.5:1 (it is ~7:1 — pass).

---

### Phase 2 — App Shell & Navigation

**Goal:** Update the persistent shell (header + bottom nav) to vibrant style.

- [ ] **2.1** Update `.topbar` styles:
  - Border bottom: `2px solid` rose-50 tint (`rgba(255,200,200,0.5)`)
  - Shadow: `0 4px 20px rgba(255,95,93,0.1)`
  - Background: `rgba(255,255,255,0.92)` (keep backdrop-filter)
- [ ] **2.2** Update `.topbar-avatar`: change to circular with 2px coral border, `border: 2px solid var(--primary-container)`.
- [ ] **2.3** Update topbar greeting style: coral color, larger weight.
- [ ] **2.4** Replace inline SVG icons in `AppShell.tsx` with Material Symbols Outlined `<span>` elements, keeping same `aria-hidden="true"` and accessible labels.
- [ ] **2.5** Update `.bottom-nav`:
  - `border-radius: 2rem 2rem 0 0` (rounded top)
  - Top border: `2px solid` rose-50 tint
  - Shadow: `0 -10px 40px rgba(255,95,93,0.15)`
  - Height: `6rem` + safe-area-inset
- [ ] **2.6** Update `.bottom-nav-link` inactive: `color: #94a3b8` (slate-400)
- [ ] **2.7** Update `.bottom-nav-link-active`: coral pill background (`background: var(--primary)`), white text, `border-radius: 1rem`, `transform: scale(1.1)`, `box-shadow: 0 4px 12px rgba(179,39,44,0.35)`.
- [ ] **2.8** Update `app-content` padding-bottom to `8rem` to account for taller nav.
- [ ] **2.9** Update floating-action-button: gradient `linear-gradient(135deg, var(--primary-container), var(--secondary-container))`, `border-radius: 1.5rem`, larger shadow.
- [ ] **2.10** Verify shell renders correctly at 370px viewport width (no overflow, nav items not clipped).
- [ ] **2.11** Run build and verify no TypeScript errors.

---

### Phase 3 — Shared Components (Cards, Buttons, Forms)

**Goal:** Update the reusable building blocks used across all pages.

- [ ] **3.1** Update `.page` card: `border-radius: 2rem`, border to `2px solid rgba(255,180,180,0.3)`, shadow to rose-tinted.
- [ ] **3.2** Update `.primary-button`: gradient background `linear-gradient(135deg, var(--primary-container), var(--primary))`, `border-radius: 1rem`, larger min-height `3.25rem`, white bold text. Add `active:translate-y-[2px]` transition class.
- [ ] **3.3** Update `.secondary-button`: `border: 2px solid` rose tint, coral text, `border-radius: 1rem`.
- [ ] **3.4** Update `.destructive-button`: keep red color, update radius.
- [ ] **3.5** Update `.field input`, `.field textarea`, `.field select`:
  - Height: `3.5rem` (56px per spec)
  - `border-radius: 1rem`
  - `background: var(--surface-subtle)`
  - `border: 2px solid transparent`
  - Focus: `border-color: var(--secondary-container)` (yellow focus per spec)
- [ ] **3.6** Update `.mobile-sheet`: `border-radius: 2rem 2rem 0 0`, `border: 2px solid rgba(255,180,180,0.3)`, rose shadow.
- [ ] **3.7** Update `.status-banner` colors using new tokens.
- [ ] **3.8** Update `.profile-color-chip`: use member profile color as tinted background.
- [ ] **3.9** Update `.info-card`: match new card style.
- [ ] **3.10** Update checkboxes (shopping list): implement new 32×32 custom checkbox style — rounded-xl, `border-2 border-tertiary-container`, checked fills teal, check icon overlay.
- [ ] **3.11** Verify all form elements have visible focus indicators meeting WCAG 2.1 AA at 370px.

---

### Phase 4 — Home Dashboard Page

**Goal:** Simplify home page to show only today's calendar events in a vibrant timeline style.

- [ ] **4.1** Update `.dashboard-page` background: `#f4fafd`.
- [ ] **4.2** **REMOVE** the week strip from `HomePage.tsx` — it is no longer rendered on the home page. The home page shows only today's events.
- [ ] **4.3** **REMOVE** the "Dinner tonight" card from `HomePage.tsx`.
- [ ] **4.4** **REMOVE** the grocery mini card and any other secondary mini-cards from `HomePage.tsx`.
- [ ] **4.5** Add/update the "Today's Fun" section as the primary page body:
  - Section header: calendar icon (teal) + "Today's Fun" label + today's date (e.g. "OCT 24") right-aligned.
  - Fetch today's events using the existing calendar query, filtered to today's date.
  - Each event row: time block (HH:MM + AM/PM) left-aligned in a `min-w-[50px]` column, then an event card with `border-l-4 border-[profileColor]`, event title, and participant names as subtitle.
  - Event card style: `background: var(--surface-container-low)`, `border-radius: 1rem`, `padding: 0.75rem 1rem`.
  - Empty state: if no events today, render a muted message card ("Nothing planned today — enjoy the day!").
- [ ] **4.6** The home page remains **read-only** — no add/delete buttons.
- [ ] **4.7** Test at 370px — event rows must not overflow; long event titles must truncate or wrap cleanly.

---

### Phase 5 — Calendar Page

**Goal:** Implement new calendar style + add delete functionality.

- [ ] **5.1** Update `.calendar-week-strip` / `.calendar-week-pill`:
  - Regular day: white, `border-radius: 1.5rem`, `border: 2px solid rgba(255,180,180,0.3)`, `min-width: 4rem`, `min-height: 6rem`
  - Active day: coral gradient (`linear-gradient(180deg, var(--primary-container), var(--primary))`), white text, `scale(1.05)`, shadow, **white dot** (`6×6px`, `border-radius: 50%`, white) rendered below the date number
  - **Event indicator dots on non-active days:** For any day that has ≥1 event, render a small coral dot (`6×6px`, `background: var(--primary-container)`, `border-radius: 50%`) below the date number. Days with no events show no dot. Dot presence is derived from the loaded week's event data — pass a map of `{ [dateString]: eventCount }` into the week strip so each pill knows whether to render its dot.
- [ ] **5.2** Update `.calendar-day-card`:
  - `border-radius: 2rem`
  - `border: 2px solid rgba(255,180,180,0.2)`
  - Rose shadow
- [ ] **5.3** Update `.calendar-event-item`:
  - Individual floating card style: `border-radius: 1.75rem`, white background, shadow
  - Thick left color border: `border-l: 12px solid` (color varies by assigned profile)
  - Category chip (small pill above title)
  - Member avatar stack (circle initials, colored border)
- [ ] **5.4** **ADD DELETE BUTTON** for each calendar event:
  - Place delete icon button (`aria-label="Delete event"`) in `.calendar-event-actions`
  - Show inline confirmation: first tap shows a "Confirm delete?" state, second tap fires mutation
  - Use `useDeleteCalendarEvent` mutation (if exists) or add delete API call
  - On success, invalidate calendar query
- [ ] **5.5** Update `.calendar-compose-card` and form styles per Phase 3.
- [ ] **5.6** Update FAB style per Phase 2.
- [ ] **5.7** Test at 370px — event items must stack single-column, delete button visible.

---

### Phase 6 — Meals Page

**Goal:** Implement new meals bento style + add delete functionality.

- [ ] **6.1** Update `.meals-header-panel` and `.meals-range-title` to new type scale.
- [ ] **6.2** Update `.meal-card`:
  - `border-radius: 2rem`
  - `border: 2px solid rgba(255,180,180,0.2)`
  - Empty state: dashed border, muted background
  - Featured (today's dinner): coral gradient background (`--primary-container`), white text
- [ ] **6.3** Update `.meals-week-strip` pills: match Phase 5.1 calendar week pill style.
- [ ] **6.4** **ADD DELETE BUTTON** for each meal card:
  - Delete icon button on non-empty meal cards
  - Inline confirmation pattern (same as calendar)
  - On success invalidate meals query
- [ ] **6.5** Update meal request cards (`.meal-request-card`):
  - Icon avatar square with category color background
  - `border-radius: 1.5rem`
  - Hover border color change to teal
- [ ] **6.6** Update `.meals-compose-card` and form styles.
- [ ] **6.7** Test at 370px.

---

### Phase 7 — Shopping Page

**Goal:** Implement new floating list item style + add delete functionality.

- [ ] **7.1** Update section headers (`.shopping-group-header`):
  - Pill container with `border-l: 8px solid` category color
  - Category icon on left
  - Item count badge pill on right
  - `border-radius: 1rem`, subtle tinted background
- [ ] **7.2** Update `.shopping-list-item` to **floating card** style:
  - Each item is its own white card: `border-radius: 1rem`, shadow, `border: 1px solid rgba(255,180,180,0.3)`
  - 48px icon square on left with category-tinted background
  - Custom large checkbox on right: `32×32`, `border-radius: 0.75rem`, `border-width: 2px`, checked = teal fill + check icon
  - Checked item: label gets `line-through`, card gets reduced opacity
- [ ] **7.3** **ADD DELETE BUTTON** for each shopping item:
  - Delete icon button visible on each item card (or swipe-style with trash icon)
  - For touch-first: show delete button always (no confirm needed for shopping — items are quick to re-add)
  - `aria-label="Remove [item name] from list"`
  - On success invalidate shopping query
- [ ] **7.4** Update `.shopping-quick-add-card` form style per Phase 3.
- [ ] **7.5** Update `.shopping-owner-chip` to use member profile color tint.
- [ ] **7.6** Test at 370px — items must not overflow, checkbox must remain accessible (min 44px tap target).

---

### Phase 8 — Family / Profiles Page

**Goal:** Implement new bento profile grid style.

- [ ] **8.1** Update `.profile-grid` to bento-style:
  - 2-column grid
  - First profile (or logged-in user): `col-span-2`, larger card with `border-2 border-primary-container`, "Active" badge, large avatar (96×96) with color border
  - Other profiles: single-column cards with smaller avatar, profile color border
- [ ] **8.2** Update `.profile-card`:
  - Remove color bar at top
  - Use `border: 2px solid` with profile color tint instead
  - `border-radius: 2rem`
  - Avatar: `border-radius: 1.5rem` (square-ish with large radius), 4px colored border
- [ ] **8.3** Replace `.profile-card-color-bar` color variants with border-color variants (profile-card-green → `border-color: #84ac8e`, etc.)
- [ ] **8.4** Update `.invite-panel` card style.
- [ ] **8.5** Add dashed-border "Add new member" button matching new design.
- [ ] **8.6** Color picker for profile: visual button grid (one button per available color, active state ring).
- [ ] **8.7** Test at 370px — 2-col grid must work; bento active card col-span-2 must fit.

---

### Phase 9 — Auth Pages

**Goal:** Update login/register screens to new design tokens.

- [ ] **9.1** Update `.auth-page`, `.auth-panel`: background `#f4fafd`, gradient update.
- [ ] **9.2** Update `.auth-toggle-button-active`: coral fill.
- [ ] **9.3** Update button, input, form styles per Phase 3.
- [ ] **9.4** Verify login/register forms accessible at 370px.

---

### Phase 10 — Backend: Delete Endpoints Verification

**Goal:** Confirm delete API endpoints exist and wire up frontend mutations.

- [ ] **10.1** Verify `DELETE /api/v1/calendar/{id}` exists and is accessible (check `CalendarEndpoints.cs`).
- [ ] **10.2** Verify `DELETE /api/v1/meals/{id}` exists (check `MealEndpoints.cs`).
- [ ] **10.3** Verify `DELETE /api/v1/shopping/{id}` exists (check `ShoppingEndpoints.cs`).
- [ ] **10.4** If any endpoint is missing, add it following existing endpoint patterns. Scope via membership. Return `Results.NoContent()` on success, `Results.NotFound()` if not found, `Results.Forbid()` if not in family.
- [ ] **10.5** Verify/add `useDeleteCalendarEvent` TanStack mutation hook in `entities/event/model/`.
- [ ] **10.6** Verify/add `useDeleteMeal` TanStack mutation hook in `entities/meal/model/`.
- [ ] **10.7** Verify/add `useDeleteShoppingItem` TanStack mutation hook in `entities/shopping-item/model/`.
- [ ] **10.8** Run `dotnet test planner.sln` — all tests must pass.

---

### Phase 11 — Accessibility Audit

**Goal:** Ensure no accessibility regressions from the refactor.

- [ ] **11.1** Audit all color contrast pairs using the new palette (text on background, text on primary, etc.):
  - `#b3272c` on `#ffffff`: ~7.2:1 ✓
  - `#b3272c` on `#f4fafd`: ~7.0:1 ✓
  - White on `#b3272c`: ~7.2:1 ✓
  - `#735c00` (secondary) on white: ~6.3:1 ✓
  - White on `#006a65` (tertiary): ~5.7:1 ✓
  - `#161d1f` on `#f4fafd`: ~17:1 ✓
- [ ] **11.2** Verify all interactive elements (buttons, checkboxes, nav links) have minimum 44×44px tap targets.
- [ ] **11.3** Verify all custom checkboxes have accessible labels (via `<label>` association or `aria-label`).
- [ ] **11.4** Verify delete buttons have `aria-label` describing what is being deleted (e.g., "Delete School Drop-off").
- [ ] **11.5** Verify skip-to-content link still works after shell update.
- [ ] **11.6** Verify all form inputs have associated `<label>` elements.
- [ ] **11.7** Verify ARIA roles (`role="alert"`, `role="status"`, `aria-live`) are preserved.
- [ ] **11.8** Verify Material Symbols icon spans have `aria-hidden="true"`.
- [ ] **11.9** Run keyboard-only navigation test through all 5 pages.
- [ ] **11.10** Test bottom nav at 370px: all 5 items must fit without clipping (may need reduced font-size for labels).

---

### Phase 12 — Playwright Verification Tests

**Goal:** Automated tests to verify visual correctness and key behaviors.

Create test file: `apps/web/src/test/ui-refactor.spec.ts` (or use existing test setup).

#### 12.1 — Design Token / Visual Checks
- [ ] **12.1.1** Navigate to home page; assert bottom nav has `border-radius` on active item.
- [ ] **12.1.2** Assert primary button background is not sky blue (`#5da9e9`) — should match coral (`#b3272c` or gradient).
- [ ] **12.1.3** Assert active nav item has white text and non-default background color.
- [ ] **12.1.4** Assert `body` font-family includes `Plus Jakarta Sans`.

#### 12.2 — Layout / Viewport Tests
- [ ] **12.2.1** Set viewport to 370×812; navigate to all 5 main pages; assert no horizontal scroll (`document.body.scrollWidth <= window.innerWidth`).
- [ ] **12.2.2** At 370px, assert bottom nav items are all visible (check that 5 nav items exist and none have `display: none`).
- [ ] **12.2.3** At 370px, assert shopping items are single-column (check grid layout).

#### 12.3 — Delete Functionality Tests (requires running backend)
- [ ] **12.3.1** Log in with test credentials; navigate to Calendar page.
- [ ] **12.3.2** Add a new calendar event; assert it appears in the list.
- [ ] **12.3.3** Click delete button on the event; confirm deletion; assert event is removed from list.
- [ ] **12.3.4** Navigate to Meals page; add a meal; delete it; assert removed.
- [ ] **12.3.5** Navigate to Shopping page; add an item; delete it; assert removed.

#### 12.4 — Accessibility Tests
- [ ] **12.4.1** Assert skip-link is present (`a.skip-link` in DOM).
- [ ] **12.4.2** Assert all form inputs have associated labels (use axe-playwright or manual check).
- [ ] **12.4.3** Assert all icon-only buttons have `aria-label` attributes.
- [ ] **12.4.4** Assert Material Symbols icon spans have `aria-hidden="true"`.
- [ ] **12.4.5** Tab through the nav bar; assert all 5 items receive focus.

#### 12.5 — Existing Behavior Regression Tests
- [ ] **12.5.1** Log in and verify dashboard loads with today's date.
- [ ] **12.5.2** Add a calendar event and verify it appears.
- [ ] **12.5.3** Add a shopping item and verify it appears and can be checked off.
- [ ] **12.5.4** Check an item off in shopping; verify label has strikethrough style.

---

### Phase 13 — Final Polish & Cleanup

- [ ] **13.1** Remove dead CSS classes that are no longer used after refactor (e.g. old `.profile-card-color-bar` variants if replaced).
- [ ] **13.2** Ensure no `!important` overrides remain from the migration.
- [ ] **13.3** Run `pnpm --filter @planner/web build` — zero errors, zero warnings.
- [ ] **13.4** Run `dotnet test planner.sln` — all tests pass.
- [ ] **13.5** Run `pnpm --filter @planner/web typecheck` — zero TypeScript errors.
- [ ] **13.6** Update `IMPLEMENTATION_PLAN.md` to note vibrant UI refactor as delivered.
- [ ] **13.7** Final visual review: open each page at 370px, 390px, 768px, and 1280px. Compare screenshots to reference images in `/docs/vibrant_ui/`.

---

## Execution Order Summary

| Phase | Description | Risk | Est. Scope |
|---|---|---|---|
| 1 | Design tokens & fonts | Low | Small |
| 2 | App Shell & Nav | Medium | Small |
| 3 | Shared components | Low | Medium |
| 4 | Home Dashboard | Low | Small |
| 5 | Calendar + Delete | Medium | Medium |
| 6 | Meals + Delete | Medium | Medium |
| 7 | Shopping + Delete | Medium | Medium |
| 8 | Family / Profiles | Low | Small |
| 9 | Auth pages | Low | Small |
| 10 | Backend delete endpoints | High | Small |
| 11 | Accessibility audit | High | Small |
| 12 | Playwright tests | Medium | Medium |
| 13 | Final cleanup | Low | Small |

> Start with Phase 10 before Phase 5-7 to know if backend work is needed. Otherwise phases 1-4 can be done independently and verified visually before the delete-button phases.
