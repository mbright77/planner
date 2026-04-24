# Frontend UX Audit

## Scope

This audit is based on the current committed frontend implementation and the product guidance in `AGENTS.md`, `IMPLEMENTATION_PLAN.md`, `docs/DESIGN.md`, and `docs/app_overview_user_flows.md`.

Review focus:

- mobile support at `360x780`
- preventing content overflow and text overflow
- usability of content-creation flows
- accessibility and inclusive interaction quality

Primary implementation reviewed:

- `apps/web/src/app/layouts/AppShell.tsx`
- `apps/web/src/app/styles/index.css`
- `apps/web/src/pages/home/HomePage.tsx`
- `apps/web/src/pages/calendar/CalendarPage.tsx`
- `apps/web/src/pages/meals/MealsPage.tsx`
- `apps/web/src/pages/shopping/ShoppingPage.tsx`
- `apps/web/src/pages/family/FamilyPage.tsx`
- `apps/web/src/pages/login/LoginPage.tsx`
- `apps/web/src/pages/invite/InvitePage.tsx`
- `apps/web/src/pages/privacy/PrivacyPage.tsx`

## Summary

The app is directionally strong: it is already mobile-first, uses large touch targets in many places, has a clear bottom navigation model, and includes some good accessibility basics such as a skip link, visible focus styling, and live region usage for app status.

The main UX issues are not about overall direction. They are about narrow-screen resilience and interaction efficiency.

Highest priority problems:

- text and layout resilience is not yet fully reliable at `360px` width
- some dashboard and card layouts are visually brittle on narrow screens
- creation flows for calendar and meals are too form-heavy for mobile use
- date and time inputs require more effort than the product model should demand
- some actions are functional but not sufficiently clear or discoverable for normal users

## Priority 1: Must Fix

### 1. Prevent text overflow and layout breakage in narrow-width flex and card layouts

Affected implementation:

- `apps/web/src/app/styles/index.css`
- `apps/web/src/app/layouts/AppShell.tsx`
- `apps/web/src/pages/home/HomePage.tsx`
- `apps/web/src/pages/meals/MealsPage.tsx`
- `apps/web/src/pages/shopping/ShoppingPage.tsx`
- `apps/web/src/pages/family/FamilyPage.tsx`

Risk:

- long family names, profile names, meal titles, shopping item labels, and notes can visually stress parent containers at `360px`
- chips and text rows can force awkward wrapping or overflow because user-generated text is not consistently protected

High-risk components:

- `topbar-title`, `topbar-meta`
- `profile-color-chip`, `shopping-owner-chip`, `dashboard-family-badge`
- `shopping-list-item`
- `meal-request-tags`
- `dashboard-mini-card`
- `profile-card-header`

Required fixes:

- add consistent `min-width: 0` to text-bearing flex children
- add explicit wrapping protection such as `overflow-wrap: anywhere` or `word-break: break-word` for user-generated content
- allow chips and metadata rows to wrap intentionally instead of stretching their containers
- verify all page titles, chips, and metadata blocks with long realistic content on `360x780`

Why this is highest priority:

- the requirement is explicit that content and text must not overflow their parent components

### 2. Make the dashboard weekly strip safe at `360x780`

Affected implementation:

- `apps/web/src/app/styles/index.css:1143-1171`
- `apps/web/src/pages/home/HomePage.tsx:80-100`

Risk:

- seven fixed columns across a narrow mobile viewport creates cramped cells and leaves little tolerance for font scaling or localization changes

Required fixes:

- either reduce the visual density specifically for narrow screens
- or convert the weekly snapshot to a horizontally scrollable strip similar to the calendar week strip

Why this is highest priority:

- this pattern appears high on the home screen and is a likely source of narrow-screen compression issues

### 3. Remove rigid square-card behavior from dashboard mini cards on narrow screens

Affected implementation:

- `apps/web/src/app/styles/index.css:1366-1379`
- `apps/web/src/pages/home/HomePage.tsx:180-210`

Risk:

- `aspect-ratio: 1 / 1` on two-column cards is too rigid for real content at `360px`
- cards may show excessive empty space in some cases and clipped or cramped content in others

Required fixes:

- remove the forced square ratio below a narrow-width breakpoint
- let cards grow naturally based on content

Why this is highest priority:

- this is a recurring mobile legibility issue, not just a stylistic preference

### 4. Improve top bar resilience for long family names and metadata

Affected implementation:

- `apps/web/src/app/layouts/AppShell.tsx:86-100`
- `apps/web/src/app/styles/index.css:81-129`

Risk:

- the top bar contains family name, page title, role metadata, avatar, and sign-out action in a compact sticky region
- long family names or localized strings can compress the heading block too aggressively at `360px`

Required fixes:

- allow meta content to wrap cleanly
- reduce text density on very narrow widths if needed
- ensure the sign-out button never forces the heading block into overflow

Why this is highest priority:

- the shell appears on every protected page, so failures here are global

### 5. Reduce date and time input friction in creation flows

Affected implementation:

- `apps/web/src/pages/calendar/CalendarPage.tsx`
- `apps/web/src/pages/meals/MealsPage.tsx`

Risk:

- native `date` and especially `datetime-local` controls are effortful and visually heavy in stacked mobile forms
- users are being asked to manually manage date context that the interface already knows from the week view

Required fixes:

- default dates from the currently selected day instead of requiring manual input first
- reduce or remove redundant date fields such as separate `Week start` and item date selection where possible
- use simpler mobile entry steps before exposing full date/time controls

Why this is highest priority:

- this directly affects the most common content creation flows in the app

### 6. Add strong empty states for creation-heavy screens

Affected implementation:

- `apps/web/src/pages/calendar/CalendarPage.tsx`
- `apps/web/src/pages/shopping/ShoppingPage.tsx`
- `apps/web/src/pages/meals/MealsPage.tsx`

Risk:

- when grouped content is empty, some screens rely too heavily on the presence of forms and do not clearly guide the next step

Required fixes:

- add explicit empty states with one recommended next action
- make sure empty states are visible and useful at narrow screen sizes

Why this is highest priority:

- empty states are part of core usability, especially on mobile where scan effort should stay low

## Priority 2: Should Improve

### 1. Simplify the calendar create flow into a day-first mobile pattern

Affected implementation:

- `apps/web/src/pages/calendar/CalendarPage.tsx:185-242`

Current issues:

- `Week start` and `Start` and `End` are all visible together
- recurrence is exposed inline before the user completes the basic task
- the form is dense and long for a mobile-first planner

Recommendation:

- make day selection the first action from the week strip
- open a compact create sheet or panel from the selected day
- ask for title first, then time, then optional assignment, notes, and recurrence
- move recurrence under a clear secondary section such as `More options`

### 2. Replace the `+1h` event action with a clearer edit model

Affected implementation:

- `apps/web/src/pages/calendar/CalendarPage.tsx:284-303`

Current issues:

- `+1h` is understandable to a developer but not a strong general-user editing affordance
- it suggests a shortcut rather than a trustworthy edit action

Recommendation:

- replace the main action with `Edit`
- use a mobile edit sheet for changes
- keep time shortcuts only as optional secondary accelerators if they prove useful

### 3. Make meals planning day-led instead of form-led

Affected implementation:

- `apps/web/src/pages/meals/MealsPage.tsx:173-209`
- `apps/web/src/pages/meals/MealsPage.tsx:214-259`

Current issues:

- users must choose `Week start`, `Meal date`, `Meal title`, `Owner`, and `Notes` in one stacked form
- for a one-meal-per-day planner, this is more input than necessary

Recommendation:

- let users tap a day card to add or edit that day's meal
- prefill the selected date automatically
- focus the first field on the meal name
- treat owner and notes as secondary details

### 4. Bring meal requests closer to the actual meal-planning moment

Affected implementation:

- `apps/web/src/pages/meals/MealsPage.tsx:261-354`

Current issues:

- meal requests appear as a separate form block below the meal planner
- requesting and planning feel like two different systems rather than adjacent actions

Recommendation:

- surface `Request meal` contextually from empty day cards or from the main meal creation entry point
- connect requests more clearly to a day or planning gap

### 5. Replace cycling assignment patterns with explicit selection

Affected implementation:

- `apps/web/src/pages/meals/MealsPage.tsx:116-155`

Current issues:

- `Rotate owner` and implicit assignment cycling are efficient for development but not transparent for users
- users should not need to remember a hidden sequence of owners

Recommendation:

- use explicit owner selection
- rename actions to communicate outcome clearly, such as `Assign person` or `Choose owner`

### 6. Make shopping quick add faster and lighter

Affected implementation:

- `apps/web/src/pages/shopping/ShoppingPage.tsx:59-96`

Current issues:

- every add asks for item, category, and optional person
- this is acceptable but still heavier than ideal for a high-frequency grocery workflow

Recommendation:

- keep the item label as the primary field
- default category to the most recent or most likely option
- collapse `Added by` unless the user needs it
- optimize for repeated add behavior with quick refocus and minimal interruption

### 7. Improve family color selection affordance

Affected implementation:

- `apps/web/src/pages/family/FamilyPage.tsx:87-96`

Current issues:

- the plain select is accessible but low-feedback and not very glanceable

Recommendation:

- use a text-labeled radio chip picker with visible previews
- keep text labels so color is never the only signal

## Priority 3: Additional Functionality That Would Improve Experience

### 1. Add a FAB or sticky contextual add action

Why:

- the design docs and user flows both point toward fast creation patterns
- a FAB fits the mobile-first planning model well if kept focused and accessible

Best use cases:

- home: quick add menu
- calendar: add event
- meals: add meal or request meal
- shopping: add item

### 2. Use search-param driven sheets for create and edit flows

Why:

- this is already aligned with the implementation plan
- it improves mobile ergonomics and preserves browser back behavior

Best use cases:

- calendar event create and edit
- meal plan create and edit
- meal request create and assign
- shopping add and maybe quick edit

### 3. Add stronger inline validation and helper text

Why:

- some current forms mainly guard on empty values and do not always explain problems inline

High-value targets:

- required title messaging
- date ordering for calendar events
- invite email quality
- meal request guidance

### 4. Persist drafts for longer creation flows

Why:

- useful for calendar notes, invite creation, and meal requests when interruptions are common on mobile

### 5. Improve shopping completion behavior

Why:

- checked items currently remain inline in the same list structure
- the user may benefit from active and completed separation while shopping in-store

### 6. Add contextual actions from empty states

Why:

- empty screens and empty day cards are ideal moments to drive fast input without requiring the user to scan a full form

## Viewport-Specific Watch List for `360x780`

These areas should be manually checked with realistic long content after fixes:

- top bar with long family names
- dashboard weekly strip
- dashboard mini cards
- meal request cards with long titles and chips
- shopping rows with long labels and owner names
- profile cards with long display names
- invite cards with long invite URLs
- date and `datetime-local` fields across mobile browsers

## Accessibility Notes

Current strengths:

- skip link is present
- visible focus styling is present
- bottom navigation uses text labels, not icon-only navigation
- status banners use `role="status"`, `aria-live`, and `role="alert"`

Important follow-up improvements:

- connect field-level errors to fields more explicitly
- simplify creation flows so mobile users do less interpretation and more direct action
- avoid opaque actions such as hidden owner cycling
- apply stronger wrapping rules to user-generated text everywhere it appears in cards and chips

## Recommended Order of Implementation

1. Fix overflow, wrapping, and narrow-width resilience in the shared CSS and shell.
2. Fix the dashboard narrow-screen patterns.
3. Simplify calendar creation to a day-first mobile flow.
4. Simplify meals planning and meal request creation around selected days.
5. Replace implicit rotate and cycle actions with explicit edit and assignment actions.
6. Speed up shopping quick add.
7. Add sheet and FAB-based creation patterns where appropriate.

## Final Assessment

The app already has a usable mobile-first foundation, but it is still closer to a functional MVP than a refined narrow-screen planning experience.

The most important next step is not visual redesign. It is interaction simplification and layout hardening at `360x780`.

Once overflow resilience and mobile creation flows are improved, the current design language should hold up much better without requiring a major UI reset.
