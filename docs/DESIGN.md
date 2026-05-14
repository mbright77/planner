# UI Design Stack

This document describes the current high-level UI implementation used by the web app.

## Core Frontend

- Framework: React 19 + TypeScript
- Build tooling: Vite
- Routing: React Router
- Data fetching/cache: TanStack Query
- Internationalization: react-i18next with static locale JSON files

## Styling System

- Utility framework: Tailwind CSS v4
- Component foundation: shadcn/ui
- Animation helpers: `tw-animate-css`
- Global tokens and theme variables: `apps/web/src/app/styles/index.css`

The UI is token-driven. shadcn/ui components read CSS variables such as `--background`, `--foreground`, `--primary`, `--muted`, `--card`, and `--border`.

## Component Libraries

- shadcn/ui components are used for app primitives:
  - Form controls: `Input`, `Textarea`, `Select`, `Switch`, `Checkbox`, `Label`
  - Structure: `Card`, `Separator`, `Alert`, `Badge`, `Tabs`
  - Overlays: `Dialog`, `Drawer`, `DropdownMenu`, `Tooltip`
  - Loading states: `Skeleton`
- Radix UI primitives are used under shadcn/ui.
- `class-variance-authority` and `cn` utility patterns are used for component variants.

## Iconography and Typography

- Icons: Hugeicons (`@hugeicons/react`, `@hugeicons/core-free-icons`)
- Font: Figtree Variable (`@fontsource-variable/figtree`)

## Theming

- Dark mode is the default theme.
- Theme preference supports `dark`, `light`, and `system`.
- Theme state is stored in `localStorage` key `planner-theme`.
- Theme initialization and persistence live in `apps/web/src/shared/lib/theme.ts`.

## Design Principles

- Mobile-first layout and touch-friendly controls.
- Clear card-based information hierarchy.
- Profile color badges are used as supporting context, never as the only signal.
- Accessibility and readability are prioritized across light and dark themes.
