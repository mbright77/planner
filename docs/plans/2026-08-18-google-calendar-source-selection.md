# Google Calendar as a selectable Overview source

> **Start here (fresh session).** Read [`AGENTS.md`](../../AGENTS.md) and
> [`docs/AGENTS.md`](../AGENTS.md) before touching code — they carry the repo's hard rules,
> notably: never hand-edit EF migrations (use repo-local `dotnet-ef`), never trust a
> client-supplied family scope, and follow current patterns over aspirational architecture.
> Work the **Ordered implementation steps** below in sequence; steps 1 and 4 are independently
> shippable and worth landing on their own. The feature self-disables when Google credentials
> are absent, so every step builds and tests green without any Google setup — only the manual
> end-to-end walkthrough needs real credentials.

## Context

The planner today has exactly one calendar: rows in `planner.calendar_events`, created and
owned by the app, surfaced on the Overview page through `GET /api/v1/dashboard/overview`.
Families who already keep their real life in Google Calendar have to duplicate every entry by
hand, so the Overview is only ever half-true.

The goal is to let each signed-in user choose which calendar sources feed their Overview —
**Local**, **Google**, or **Both** — with Google reached through the existing authenticated
.NET backend and bound to the existing ASP.NET Identity user. No second frontend auth
mechanism: the React app never sees a Google token, never runs a Google SDK, and never holds
a Google session. It asks our API for a consent URL, navigates there, and our API handles the
rest.

Decisions already taken (from the pre-plan questions):

| Decision | Choice |
|---|---|
| Preference scope | **Per-user**, mirroring the existing per-profile `PreferredLanguage`/theme pattern |
| Refresh-token encryption | **AES-256-GCM**, key from a k8s Secret (outside the database) |
| Google API access | **Typed `HttpClient`**, no `Google.Apis.*` SDK |
| First-pass reach | **Overview page only**; `/calendar` week grid stays local-only |
| Google calendars | **Multi-select** — the user picks which of their Google calendars feed the Overview, not just `primary` |

---

## How the calendar works today

**Backend**

- `apps/api/src/Planner.Domain/AssemblyMarker.cs` — every entity lives here by convention.
  `CalendarEvent` (`FamilyId`, `Title`, `Notes`, `StartAtUtc`, `EndAtUtc`, `AssignedProfileId`,
  `SeriesId`) and `CalendarEventSeries` (weekly recurrence, materialized ahead by
  `CalendarSeriesMaterializer` + a hosted worker). Recurrence is **pre-expanded into rows**,
  so nothing downstream ever expands an RRULE. There is no all-day concept.
- [CalendarEndpoints.cs](../../apps/api/src/Planner.Api/Endpoints/CalendarEndpoints.cs) — CRUD +
  `/week`. Correctly converts family-local dates to UTC via `TimeZoneInfo.ConvertTimeToUtc`
  (lines 48–55) using `Family.Timezone`.
- [DashboardEndpoints.cs](../../apps/api/src/Planner.Api/Endpoints/DashboardEndpoints.cs) — the
  Overview's only data source. Builds `todayEvents`, a 7-day strip with event counts, tonight's
  meal, a shopping summary, and the next upcoming event.
- Every family-scoped handler repeats the same `GetMembershipAsync` → `membership.FamilyId`
  scoping. `ResolveTimeZone`/`GetWeekStart` are copy-pasted into `CalendarEndpoints`,
  `DashboardEndpoints` **and** `MealEndpoints`.

**Pre-existing defect this work must fix.** `DashboardEndpoints` builds its day and week
boundaries with `DateTimeKind.Utc` stamped onto family-*local* dates (lines 39–42) and groups
the week strip by `x.StartAtUtc.UtcDateTime` (line 148). For any family not on UTC, "today"
on the Overview is skewed by the offset. Correct day boundaries are a hard prerequisite for
asking Google for "today's events", so this gets fixed as step 1 rather than layered over.

**Frontend**

- [HomePage.tsx](../../apps/web/src/pages/home/HomePage.tsx) — renders `dashboardQuery.data.todayEvents`,
  keyed by `event.id` (a GUID), timed with `formatTimeBlock`, colored by assigned profile.
- [FamilyPage.tsx](../../apps/web/src/pages/family/FamilyPage.tsx) — per-user settings (language,
  theme) live inside the `profile.linkedUserId === currentUserId` block at lines 360–414.
  **That is where the calendar-source control belongs.**
- `packages/api-client` — types generated from OpenAPI (`pnpm --filter @planner/api-client
  generate`, which boots the API), with hand-written wrapper functions in `src/index.ts`.
- `useOfflineQuery` caches reads into IndexedDB; `offlineMutationQueue.tsx` queues writes by
  typed `kind`.

Nothing Google-related exists in the backend today. The only hit is
`generateGoogleCalendarLink` in `apps/web/src/shared/lib/calendar.ts` — an unrelated
"add to my calendar" deep link. **Leave it alone; it is not part of this feature.**

---

## Recommended model

Four new entities in `AssemblyMarker.cs` (repo convention), plus two enums.

```csharp
public enum CalendarSourceSelection { Local = 1, Google = 2, Both = 3 }
public enum GoogleConnectionStatus  { Connected = 1, NeedsReauth = 2 }
```

**`UserCalendarPreference`** — `Id`, `UserId` (Identity id, unique), `FamilyId`,
`Sources` (`CalendarSourceSelection`, default `Local`), `UpdatedAtUtc`.
Absent row = `Local`, so no backfill migration is needed.

**`GoogleCalendarConnection`** — a **separate integration entity**, one row per Identity user
(unique index on `UserId`), not columns bolted onto `Profile` or `FamilyMembership`. It carries
credential material with a different lifecycle, different security posture, and a status the
preference does not have; keeping it separate means "disconnected" is a row deletion rather
than five nullable columns. Fields: `Id`, `UserId`, `FamilyId`, `GoogleAccountEmail`,
`GoogleAccountSubject` (the `sub` claim),
`RefreshTokenCipher`/`RefreshTokenNonce`/`RefreshTokenTag` (`byte[]`), `KeyVersion` (int, for
rotation), `GrantedScopes`, `Status`, `ConnectedAtUtc`, `LastSyncAtUtc`, `LastErrorAtUtc`,
`LastError`, and `CalendarsSyncedAtUtc` (stamped by the subscription reconciler; surfaced in
the settings UI as "calendar list last refreshed").

**`GoogleCalendarSubscription`** — one row per calendar in the connected Google account, a
child of the connection (cascade delete): `Id`, `ConnectionId`, `GoogleCalendarId` (opaque
string, unique per connection), `Summary` (display name as Google reports it),
`Description`, `ColorHex`, `TimeZone`, `AccessRole`, `IsPrimary`, `IsSelected`,
`LastSeenAtUtc`. This is a **cached mirror of Google's `calendarList`, not a source of truth** —
it exists so the settings UI renders instantly and so a selection survives a transient Google
outage. Only `IsSelected` is ours; every other field is refreshed from Google.

Access tokens are **not persisted** — they are cached in `IMemoryCache` keyed by connection id
with `expires_in - 60s` TTL. A cold process costs one extra refresh call.

**`GoogleOAuthState`** — the CSRF/PKCE bridge across the unauthenticated callback:
`Id`, `UserId`, `StateHash` (SHA-256 of the state value, unique), `CodeVerifier`,
`CreatedAtUtc`, `ExpiresAtUtc` (+10 min), `ConsumedAtUtc`. Single-use.

EF configurations go in `Persistence/Configurations/` one class per entity, `ToTable`
snake_case (`user_calendar_preferences`, `google_calendar_connections`,
`google_calendar_subscriptions`, `google_oauth_states`),
enums via `.HasConversion<string>()` per
[FamilyMembershipConfiguration.cs](../../apps/api/src/Planner.Infrastructure/Persistence/Configurations/FamilyMembershipConfiguration.cs),
`FamilyId` FK cascade-delete from `Family`.

**Deletion cleanup — one path needs new code.** The two flows in
[PrivacyEndpoints.cs](../../apps/api/src/Planner.Api/Endpoints/PrivacyEndpoints.cs) behave
differently, and only one is covered by the cascade:

- `DeleteFamilyAsync` removes the `Family` row, so the preference, connection and subscriptions
  all cascade away. **No change needed.**
- `DeleteAccountAsync` removes only the user's `FamilyMembership` and then calls
  `userManager.DeleteAsync(user)`. Nothing links our tables to `AspNetUsers` by FK, so the
  user's `GoogleCalendarConnection` — **holding their encrypted Google refresh token** — and
  their `UserCalendarPreference` would survive with a dangling `UserId`. `DeleteAccountAsync`
  must explicitly delete both (and any `GoogleOAuthState` rows) for that user before deleting
  the Identity user, and should best-effort call `RevokeAsync` at Google first. Covered by a
  dedicated test.

---

## OAuth flow

Authorization Code + PKCE, entirely server-side, bound to the Identity user by the `state` row.

1. **Family page** → `POST /api/v1/integrations/google/authorize` (JWT-authenticated).
   Backend generates 32 random bytes for `state` and a PKCE `code_verifier`, writes a
   `GoogleOAuthState` row (state stored **hashed**, verifier in plaintext — it is single-use
   and short-lived), and returns the consent URL with `access_type=offline`, `prompt=consent`,
   `code_challenge_method=S256`, and scopes
   `https://www.googleapis.com/auth/calendar.events.readonly`
   `https://www.googleapis.com/auth/calendar.calendarlist.readonly` `openid` `email`.
   Deliberately **not** `calendar.readonly`: the two narrow scopes grant exactly "read events"
   and "see which calendars I subscribe to", where `calendar.readonly` means "see and download
   any calendar you can access". Both are needed — verified against the endpoint references,
   `events.list` accepts `calendar.events.readonly` but `calendarList.list` does **not**.
2. Frontend does `window.location.assign(authorizationUrl)`.
3. Google redirects the browser to `GET /api/v1/integrations/google/callback?code&state` —
   **`AllowAnonymous`**, because a top-level navigation carries no `Authorization` header. The
   handler looks the state up by hash, rejects unknown/expired/already-consumed values, marks
   it consumed, and reads `UserId` from the row. This is the single mechanism that ties the
   Google grant to the Identity user — no client-supplied user id is ever trusted.
4. Exchange `code` + `code_verifier` at `https://oauth2.googleapis.com/token`. Take
   `refresh_token`, `access_token`, `expires_in`, and email/`sub` from the `id_token`.
5. Upsert `GoogleCalendarConnection` with the encrypted refresh token, `Status = Connected`,
   then call `calendarList.list` through `IGoogleCalendarSubscriptionService` (the same
   reconciliation used by `?refresh=true`, never a naive insert). How the selection is seeded
   depends on what was already there — **this distinction matters, get it right**:

   | Case | Detected by | Selection behaviour |
   |---|---|---|
   | First ever connect | no existing connection row | Seed **primary calendar only** — a safe default that never surfaces a shared work or holiday calendar unasked |
   | Reconnect, same account | existing row, same `GoogleAccountSubject` | **Preserve `IsSelected` exactly.** Reconnecting after `NeedsReauth` must not silently reset someone's four ticked calendars back to primary-only |
   | Reconnect, different account | existing row, different `GoogleAccountSubject` | Delete the old subscription rows (they belong to another account and would 404 forever), then seed primary-only as a first connect |

   Then, if the user's preference is still `Local`, upgrade it to `Both`.
6. HTTP 302 to `{Google:PostConnectRedirectUrl}?googleCalendar=connected`, or
   `?googleCalendar=error&reason=<slug>` on any failure. See **Post-connect redirect** below —
   the target is the app's **base path**, not a deep link.

### Post-connect redirect

`Google:PostConnectRedirectUrl` is the app's base URL, and deliberately **not** a route:

```
https://mbright77.github.io/planner/     # production
http://localhost:5173/                   # development
```

This matters because of how the frontend is hosted. GitHub Pages serves static files, so a
redirect to a deep link like `/planner/family?googleCalendar=connected` finds no such file and
falls through to [404.html](../../apps/web/public/404.html), which bounces to
`/planner/?route=<encoded>` for the shim in [main.tsx](../../apps/web/src/main.tsx) to unpack.
That path does work and does preserve the query string — but it costs an extra redirect, it
depends on a JS shim, and the `<meta http-equiv="refresh">` fallback inside `404.html` drops
the route entirely. Redirecting to the base path hits `index.html` directly and sidesteps all
of it.

Two rules for the handler:

- **The redirect target always comes from configuration, never from the request.** No
  `returnTo` parameter, no `Referer`-derived target, nothing echoed out of the `state` row.
  A callback that redirects to a caller-supplied URL is an open redirect, and this one is
  reachable anonymously. The configured value is the only permitted destination; the sole
  variable part is the query string the handler appends.
- **Validate it once at startup.** Parse `PostConnectRedirectUrl` during options binding and
  fail fast if it is missing or not absolute, rather than discovering it in a 302 that sends a
  user somewhere strange.

Because the target is now the base path rather than `/family`, the app has to route itself the
rest of the way — see the frontend section.

Security properties: refresh token never reaches the browser; `state` is single-use, hashed at
rest, 10-minute TTL, and bound to one user; PKCE covers code interception; token values are
never logged (log connection id and error class only).

**Token handling.** `AesGcmTokenCipher` (new, `Planner.Infrastructure/Security/`) wraps
`System.Security.Cryptography.AesGcm` with a 32-byte key read from `Google:TokenEncryptionKey`
(base64) and a per-record random 96-bit nonce. `KeyVersion` is stored per row so a future key
can be introduced without a big-bang re-encryption. On `invalid_grant` from a refresh (user
revoked access in their Google account, or password change), set `Status = NeedsReauth`, keep
the row so the UI can offer **Reconnect**, and stop calling Google for that user.

**Never overwrite a stored refresh token with nothing.** Google does not guarantee a
`refresh_token` on every token response — `prompt=consent` makes it very likely on the
authorization exchange, and refresh responses routinely omit it. The write path must treat a
missing or empty `refresh_token` as "keep what is already stored", never as "store null".
Getting this wrong bricks a connection permanently on one odd response, and it is invisible
until the cached access token expires an hour later. Enforce it in a single
`UpdateRefreshToken(connection, tokenResponse)` helper rather than at each call site, and cover
it with a unit test.

---

## Backend API changes

New file `apps/api/src/Planner.Api/Endpoints/CalendarSourceEndpoints.cs`, registered in
`PlannerEndpoints.cs`, following the existing one-class-per-feature route-group style.

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/calendar/sources` | JWT | Current preference + Google connection summary + whether the feature is configured at all |
| PUT | `/api/v1/calendar/sources` | JWT | Set `Local` \| `Google` \| `Both`; `400` if Google is selected without a healthy connection **and at least one selected calendar** |
| POST | `/api/v1/integrations/google/authorize` | JWT | Create state row, return consent URL |
| GET | `/api/v1/integrations/google/callback` | **Anonymous** | Validate state, exchange code, store connection, seed calendars, 302 back to the app |
| GET | `/api/v1/integrations/google/calendars` | JWT | Cached subscription rows; `?refresh=true` re-reads `calendarList.list` and reconciles |
| PUT | `/api/v1/integrations/google/calendars` | JWT | Replace the selected set (`{ "selectedCalendarIds": [...] }`); `400` on unknown ids |
| POST | `/api/v1/integrations/google/disconnect` | JWT | Revoke at Google, delete the row (subscriptions cascade), downgrade preference to `Local` |

The callback is the **only anonymous surface** this feature adds. It falls into the existing
general rate-limit partition (300/min per IP) configured in
[ServiceCollectionExtensions.cs](../../apps/api/src/Planner.Api/DependencyInjection/ServiceCollectionExtensions.cs);
that is adequate because an attacker without a valid unconsumed `state` gets rejected before
any Google call is made. No new partition is needed — noted so the next reader doesn't have to
re-derive it.

Disconnect is `POST` rather than `DELETE` deliberately — the generated api-client's
`HttpMethod` union in `packages/api-client/src/index.ts` is `'get' \| 'post' \| 'put'`, and this
avoids widening it (the web app's two existing DELETEs bypass the client via raw `http()`).

New contracts in `apps/api/src/Planner.Contracts/Integrations/CalendarSourceContracts.cs`
(`sealed record`, flat, string-valued enums per convention):
`CalendarSourceSettingsResponse`, `GoogleConnectionSummary`, `UpdateCalendarSourcesRequest`,
`GoogleAuthorizationUrlResponse`, `GoogleCalendarSummary` (`GoogleCalendarId`, `DisplayName`,
`ColorHex`, `AccessRole`, `IsPrimary`, `IsSelected`), `GoogleCalendarListResponse`
(the calendars plus `CalendarsSyncedAtUtc`), `UpdateGoogleCalendarSelectionRequest`.

The contract field is `DisplayName`, mapped from the entity's `Summary` (which keeps Google's
own field name) — `GoogleCalendarSummary.Summary` would read as a tautology on the wire.

**Breaking change to `DashboardContracts.cs`:** `DashboardEventSummary.Id` becomes `string`
(Google ids are opaque strings), plus new `Source` (`"Local"`/`"Google"`), `SourceLabel` (the
originating calendar's name, so two Google calendars are tellable apart), `SourceColorHex`,
`IsAllDay`, and `IsReadOnly`. `DashboardOverviewResponse` gains a `Sources` block carrying the
active preference and per-source status. Only `HomePage.tsx` consumes these, and only as a
React key plus display fields.

**Configuration** (`Google` section; the feature self-disables when `ClientId`/`ClientSecret`
are blank, so local dev and CI are unaffected until real values are supplied):

- Secret (`infra/k8s/planner-api/secret.example.yaml`, beside `Jwt__SigningKey`):
  `Google__ClientSecret`, `Google__TokenEncryptionKey`
- ConfigMap (`configmap.example.yaml`): `Google__ClientId`, `Google__RedirectUri`,
  `Google__PostConnectRedirectUrl`
- `appsettings.json` / `appsettings.Development.json`: empty placeholders only

The two URL values, spelled out — note `RedirectUri` carries the `PathBase` in production but
**not** locally, since `PathBase` is `/planner-api` in the ConfigMap and `""` in
`appsettings.Development.json`. Each must be registered verbatim as an authorized redirect URI
in the Google Cloud console; Google matches byte-for-byte.

| | Production | Development |
|---|---|---|
| `Google__RedirectUri` | `https://<api-host>/planner-api/api/v1/integrations/google/callback` | `http://localhost:5254/api/v1/integrations/google/callback` |
| `Google__PostConnectRedirectUrl` | `https://mbright77.github.io/planner/` | `http://localhost:5173/` |

---

## Google Calendar retrieval, timezone, all-day and recurring

New services under `apps/api/src/Planner.Infrastructure/Integrations/Google/`, registered in
`Planner.Infrastructure/DependencyInjection.cs` via `AddHttpClient` (5-second timeout):

- `IGoogleOAuthClient` — `BuildAuthorizationUrl`, `ExchangeCodeAsync`, `RefreshAsync`, `RevokeAsync`
- `IGoogleAccessTokenProvider` — cache → refresh → `NeedsReauth` on `invalid_grant`
- `IGoogleCalendarClient` — `ListCalendarsAsync` (`calendarList.list`) and `ListEventsAsync`
  (`events.list`, **one calendar per call**; this interface knows nothing about selection or
  fan-out — it is a thin transport over the two HTTP endpoints)
- `IGoogleCalendarSubscriptionService` — reconciles `calendarList` against the stored
  subscription rows: upserts by `GoogleCalendarId`, refreshes display fields, preserves
  `IsSelected`, and removes rows Google no longer returns (a calendar the user deleted or was
  unshared from) — so a vanished calendar silently drops out of the selection instead of
  erroring on every Overview load
- `IGoogleCalendarEventReader` — **owns the fan-out.** Given a connection and a date range it
  reads the selected subscriptions, issues one `ListEventsAsync` per selected calendar via
  `Task.WhenAll` under a concurrency cap of 4 and a shared deadline, maps results to the shared
  shape, and converts per-calendar exceptions into a per-calendar status instead of
  propagating. Returns events **plus** an aggregate Google status

**Division of labour, so this is unambiguous:** `IGoogleCalendarClient` = one HTTP call.
`IGoogleCalendarEventReader` = all Google calendars for one user, fan-out and error containment.
`ICalendarAggregator` = merges the reader's output with the local EF query. Nothing else fans
out; nothing else catches Google errors.

The events call is
`GET /calendar/v3/calendars/{calendarId}/events?singleEvents=true&orderBy=startTime&timeMin=…&timeMax=…&timeZone={Family.Timezone}&maxResults=250`,
following `nextPageToken` if present. The reader issues it once per selected calendar (see the
fan-out note above), so five selected calendars cost roughly one calendar's latency rather than
five. `calendarList.list` is covered
by the separate `calendar.calendarlist.readonly` scope requested at consent — it is **not**
authorized by `calendar.events.readonly`, which is why both scopes are requested.

- **Recurring:** `singleEvents=true` makes Google expand RRULEs, EXDATEs and per-instance
  overrides for us. No RRULE parser enters this codebase — which matches how the local side
  already works (pre-materialized rows).
- **Timezone:** `timeMin`/`timeMax` are the family-local day/week boundaries converted through
  `Family.Timezone` with `TimeZoneInfo.ConvertTimeToUtc` — the same conversion
  `CalendarEndpoints` already does, once the Dashboard bug is fixed. `timeZone` is also sent so
  Google resolves floating and all-day values against the family's zone.
- **All-day:** these arrive as `start.date`/`end.date` (no time, end **exclusive**). Map to
  `IsAllDay = true`, `StartAtUtc` = family-local midnight of `start.date` in UTC, `EndAtUtc` =
  family-local midnight of `end.date` (already exclusive, so no `-1 day` fudge).
- **Cancelled** instances (`status = "cancelled"`) and declined invitations are filtered out.

**Combining sources.** New `ICalendarAggregator` (`Planner.Infrastructure/Calendar/`) returns
a merged `IReadOnlyList<AggregatedEvent>` plus a per-source status. It fetches the whole
Overview **week** in one call to the reader, which fans out per selected calendar, each
covering the whole week for the same cost as a single day — so today's list, the 7-day strip counts and the
next-upcoming event all derive from the same merged set. Merge rules:

- Union across the local table and every **selected** Google calendar, sorted by `StartAtUtc`,
  then by title for stable ordering.
- **No de-duplication.** Title/time heuristics silently hide real events; if a family
  double-books, showing both is the honest answer. This matters more with multi-calendar: the
  same event legitimately appears on two calendars when a user is an attendee on one and the
  owner of another, and guessing which to drop would be wrong as often as right.
- Google events get `AssignedProfileId = null`, `IsReadOnly = true`, and `SourceLabel` set to
  the originating calendar's name — they render with a text badge naming the calendar, never
  color as the only signal (per the product rules).
- Results cached in `IMemoryCache` for 60 seconds keyed by `(connectionId, weekStart,
  selectedCalendarSetHash)`, so changing the selection invalidates immediately.
- **Google failures never fail the Overview, and one bad calendar never poisons the rest.**
  Per-calendar results are independent: if three of four succeed, those events render and the
  response carries `sources.google.status = "Partial"` naming the failed calendar. On timeout,
  5xx, or `NeedsReauth`, the endpoint returns 200 with the local events plus a status of
  `"Error"` or `"NeedsReauth"`. A user whose Google grant lapsed still sees their local planner.

---

## Frontend changes

- `apps/web/src/shared/api/calendarSources.ts` — thin wrappers over regenerated api-client
  functions (`getCalendarSources`, `updateCalendarSources`, `startGoogleAuthorization`,
  `getGoogleCalendars`, `updateGoogleCalendarSelection`, `disconnectGoogleCalendar`),
  mirroring `shared/api/invites.ts`.
- `apps/web/src/entities/calendar-source/model/useCalendarSources.ts` — plain `useQuery`,
  **not** `useOfflineQuery`: a stale IndexedDB "connected" answer would be actively misleading.
  Mutations invalidate `['calendar-sources']`, `['google-calendars']` and
  `['dashboard-overview']` and are **not** registered in `offlineMutationQueue` — OAuth
  requires connectivity by definition.
- **`FamilyPage.tsx`** — a "Calendar sources" block inside the existing
  `profile.linkedUserId === currentUserId` section (lines 360–414), next to Language and Theme:
  a shadcn `Select` (Local / Google / Both, with Google options disabled until connected), and
  a connection row showing **Connect** (`window.location.assign`), the connected Google account
  email as a `Badge`, **Reconnect** when `NeedsReauth`, and **Disconnect**. The whole block is
  hidden when the API reports the integration is not configured.
- **Calendar picker** — once connected, a list of the account's calendars rendered with the
  existing shadcn `Checkbox` (`components/ui/checkbox.tsx`, already used by Shopping), one row
  per calendar showing its name, a color dot **plus** its `accessRole` as text, and the primary
  calendar marked. Selection saves on change (optimistic, reverting on error) via
  `PUT /api/v1/integrations/google/calendars`; a small **Refresh list** button re-reads from
  Google with `?refresh=true`. Deselecting everything while the preference is `Google`/`Both`
  is blocked client-side with an inline message rather than silently emptying the Overview.
  Long lists (some accounts have dozens of subscribed holiday calendars) render in a
  `max-h-*` scroll container so the settings card stays usable on mobile.
- **Return handling** — the callback lands on `/` (the base path), not on `/family`, so this
  is handled **above the page** rather than inside `FamilyPage`. Add a small
  `useGoogleConnectReturn()` hook mounted once in
  [AppShell.tsx](../../apps/web/src/app/layouts/AppShell.tsx), which on mount reads
  `?googleCalendar=connected|error` (and `reason`) via `useSearchParams` and, when present:
  1. `navigate('/family', { replace: true })` so the user lands where the setting lives;
  2. invalidates `['calendar-sources']`, `['google-calendars']` and `['dashboard-overview']`;
  3. hands the outcome to `FamilyPage` for display — simplest via a `location.state` flag set
     on that `navigate` call, avoiding a new context for one boolean;
  4. strips both params from the URL so a refresh or a re-share doesn't replay the alert.

  Placing it in `AppShell` means it sits inside `ProtectedRoute`, so an expired app session
  redirects to login first and the handling runs after sign-in rather than being silently lost.
  `FamilyPage` renders the resulting success or error `Alert`; the error copy is keyed off
  `reason` with a generic fallback, since the slug comes from our own backend and should never
  be rendered raw.
- **`HomePage.tsx`** — key by the now-string `event.id`; render an "All day" chip instead of a
  time when `isAllDay`; and show a destructive `Alert` above the card linking to `/family` when
  `sources.google.status` is `NeedsReauth`, `Error`, or `Partial`. For `source === 'Google'`,
  render a badge whose **text** is `sourceLabel` (the calendar's name) with `sourceColorHex`
  applied as a small leading dot — the color is decoration on top of the name, never the only
  signal, per the product rules. Fall back to the existing neutral border when
  `sourceColorHex` is null, reusing the `getProfileAccentColor` fallback pattern already in
  the file.
- **How the frontend knows Google is connected:** solely from `GET /api/v1/calendar/sources`
  (Family page) and the `sources` block on the Overview response. It never inspects a token,
  and nothing Google-related is added to `bootstrap` — this is not bootstrap-visible data.
- **i18n** — new `calendarSources.*` keys in `en/family.json` + `sv/family.json`, and the
  all-day/source/reconnect strings in `en/home.json` + `sv/home.json`. Swedish must be real
  UTF-8 åäö.

---

## Ordered implementation steps

1. ✅ **DONE** — **Fix the Dashboard timezone bug first.** Extract `ResolveTimeZone`/`GetWeekStart` into one
   shared helper and reuse it from `CalendarEndpoints`, `DashboardEndpoints` and
   `MealEndpoints` (three copies today). Convert Dashboard's day/week boundaries and the
   `eventCountsByDate` grouping through `Family.Timezone`. Add a failing test first, extending
   `TimezoneWeekTests`.
2. ✅ **DONE** — **Domain + persistence.** Four entities and two enums in `AssemblyMarker.cs`, `DbSet`s on
   `PlannerDbContext`, four configuration classes, then one migration via repo-local tooling:
   `dotnet dotnet-ef migrations add AddGoogleCalendarIntegration …` (never hand-edited).
3. ✅ **DONE** — **Crypto.** `AesGcmTokenCipher` + options binding + unit tests (round-trip, tampered
   ciphertext must throw, wrong key must throw) before anything stores a token.
4. ✅ **DONE** — **Preference slice, Google-free.** `GET`/`PUT /api/v1/calendar/sources` and the
   `Sources` block on the Overview response, with `Google` selection rejected while no
   connection exists. Ship and test this on its own — it is independently valuable.

   > Steps 1–4 merged to `main` and pushed (commits `127c61aa`..`76541a70`). Verified with the
   > full `dotnet test`/`pnpm build` suite plus a manual pass against real PostgreSQL 16 (schema
   > + live HTTP checks) in a throwaway scratch database. Deployed via the existing
   > `deploy-backend-k3s.yml` pipeline (`RUN_DEPLOY`/`RUN_MIGRATIONS_ON_DEPLOY` both enabled).

5. ✅ **DONE** — **OAuth endpoints.** Authorize / callback / disconnect, `IGoogleOAuthClient` over a typed
   `HttpClient`, state validation, the `UpdateRefreshToken` guard, and expired-state cleanup
   piggybacked on the authorize handler. **In the same step**, extend `DeleteAccountAsync` in
   `PrivacyEndpoints.cs` to revoke and delete the connection, preference and state rows — do
   not defer this, it is the step that first writes a refresh token to the database.

   > Committed on `worktree-google-calendar-oauth` (not yet merged). Reviewed with
   > `code-review --level high` (8 parallel finder angles, 10/10 findings fixed) — including two
   > real bugs beyond the original scope: `DeleteFamilyAsync` was never revoking or cleaning up
   > `GoogleOAuthState` rows for family members (no `FamilyId` FK covers that table, so the
   > `Family` cascade alone silently orphaned them), and `AesGcmTokenCipher`'s eager constructor
   > validation was throwing 500s on any endpoint injecting `ITokenCipher` while Google is
   > unconfigured — moved to lazy validation at first use, with matching startup validation added
   > for `TokenEncryptionKey` so a bad value still fails fast at boot. Calendar seeding and the
   > preference auto-upgrade-to-`Both` on connect were deferred to Step 6, since they depend on
   > `IGoogleCalendarSubscriptionService`/`ListCalendarsAsync`, which don't exist until that step.
   > Merged to `main` (local; pushed on request). Not yet tested against real Google credentials.

6. ✅ **DONE** — **Calendar list + selection.** `ListCalendarsAsync`,
   `IGoogleCalendarSubscriptionService` reconciliation, the two
   `/integrations/google/calendars` endpoints, and primary-only seeding on connect.

   > Committed on `worktree-google-calendar-list` (not yet merged). Reviewed with
   > `code-review --level high` (8 parallel finder angles, 10/10 findings addressed) — including
   > two real bugs the review agents disagreed on the exact mechanism of but both traced to the
   > same symptom: reconciliation could leave `UserCalendarPreference` at `Both`/`Google` with
   > zero calendars selected (no path back, since `PUT /calendars` rejects both an empty and a
   > non-empty-but-unknown selection) — fixed with a `SyncPreferenceWithSelectionAsync` helper
   > that auto-downgrades to `Local` when a *background* reconciliation empties the selection,
   > deliberately distinct from a direct `PUT` to zero, which still rejects (there's a real user
   > action to reject there). The second bug was caught by my own regression test rather than by
   > the review itself: `ReconcileAsync` was double-adding every newly created subscription to
   > `connection.Subscriptions` — once explicitly, once via EF's automatic relationship fixup from
   > `dbContext.Add()` — so any reconcile that created a calendar returned it twice in the API
   > response. Also fixed: two endpoints missing the `IsConfigured` guard every sibling endpoint
   > has, a missing try/catch around reconciliation on the refresh path (unlike the callback's
   > deliberate tolerance), missing primary-only seeding on a connection's first successful
   > reconcile via refresh, and access-token refresh treating request cancellation as a genuine
   > Google auth failure. Verified with `dotnet test`/`pnpm build` (68 backend tests green); not
   > yet tested against real Google credentials or merged to `main`.
7. ✅ **DONE** — **Google read path.** `IGoogleCalendarClient.ListEventsAsync` + `IGoogleAccessTokenProvider`
   + `IGoogleCalendarEventReader`, with mapping unit tests (timed, all-day, cross-midnight,
   recurring instance, cancelled).

   > Committed on `worktree-google-calendar-read-path` and merged to `main` (fast-forward,
   > `e83e15b8`; local only, not yet pushed). `IGoogleAccessTokenProvider` caches the access
   > token in `IMemoryCache` keyed by connection id (`expires_in - 60s` TTL, 30s floor) and
   > short-circuits without calling Google when the connection is already `NeedsReauth`.
   > `IGoogleCalendarEventReader` fans out `ListEventsAsync` across selected subscriptions with a
   > `SemaphoreSlim(4)` concurrency cap and a shared 10s deadline layered over each call's own
   > `HttpClient` timeout, mapping each raw entry through a new pure `GoogleCalendarEventMapper`
   > into the shared `AggregatedEvent` shape (`Planner.Infrastructure/Calendar/`, introduced now
   > since step 8's `ICalendarAggregator` will reuse it directly) and containing per-calendar
   > failures into an aggregate `GoogleSourceStatus` (`Ok`/`Partial`/`Error`/`NeedsReauth`) rather
   > than throwing. Cancelled instances and events the connected user declined are filtered out in
   > the mapper, not the client, keeping `IGoogleCalendarClient` a thin one-call-per-calendar
   > transport. **In the same step**, replaced `GoogleIntegrationEndpoints.GetCalendarsAsync`'s
   > ad-hoc `TryGetFreshAccessTokenAsync` (explicitly flagged in step 5's own code as a stopgap
   > "until event-fetching also needs a fresh token") with the new cached provider, deleting the
   > duplicate refresh logic; behavior is unchanged per the existing `GoogleCalendarApiTests`
   > (expired-grant and refresh-list tests pass unmodified). Verified with `dotnet
   > build`/`dotnet test` (85 backend tests green, up from 68) and `pnpm --filter @planner/web
   > build`; not yet tested against real Google credentials.
8. ✅ **DONE** — **Aggregation.** `ICalendarAggregator` with the per-calendar fan-out, wired into
   `DashboardEndpoints`; contract change to `DashboardEventSummary`; caching keyed on the
   selected set; partial-failure handling.

   > Committed on `main` (`dd5ffbda`). `ICalendarAggregator` merges local and Google events
   > with stable ordering (StartAtUtc, then title), no de-duplication. Google events cached for
   > 60s keyed by `(connectionId, weekStart, selectedCalendarSetHash)`. Partial failures surfaced
   > in `DashboardGoogleSourceStatus` - Google errors never fail the Overview. Contract changes:
   > `DashboardEventSummary.Id` and `DashboardUpcomingEventSummary.Id` changed from `Guid` to
   > `string` to accommodate Google's opaque IDs, with new `Source`/`SourceLabel`/`SourceColorHex`/
   > `IsAllDay`/`IsReadOnly` fields. Verified with `dotnet build`/`dotnet test` (85 backend tests
   > green) and all existing tests pass.
9. ✅ **DONE** — **Regenerate the api-client** (`pnpm --filter @planner/api-client generate`) and add the six
   wrapper functions to `packages/api-client/src/index.ts` by hand.
   
   > Committed as `30322755`. Regenerated OpenAPI types from running backend and added 9 type
   > exports + 6 wrapper functions (getCalendarSources, updateCalendarSources, startGoogleAuthorization,
   > getGoogleCalendars, updateGoogleCalendarSelection, disconnectGoogleCalendar).
10. ✅ **DONE** — **Frontend.** API wrappers → query hooks → `useGoogleConnectReturn` in `AppShell` →
    FamilyPage block and calendar picker →
    HomePage rendering → i18n (all four JSON files).
    
   > Committed as `94e625f0`. Added:
   > - `apps/web/src/shared/api/calendarSources.ts` - 6 API wrapper functions
   > - `apps/web/src/entities/calendar-source/model/useCalendarSources.ts` - 6 query/mutation hooks
   > - `AppShell.tsx` - OAuth callback return handling with query invalidation
   > - `CalendarSourcesSection.tsx` - Full calendar source settings component
   > - `FamilyPage.tsx` - Integrated CalendarSourcesSection
   > - `HomePage.tsx` - Google event rendering with source badges, all-day support, status alerts
   > - i18n translations in en/sv family.json and home.json
11. ✅ **DONE** — **Infra + docs.** Secret/ConfigMap examples, `appsettings` placeholders, and a short
    `docs/runbooks/google-calendar.md` covering Google Cloud console setup and the
    reconnect path.
    
   > Committed as `db38d978`. Added:
   > - Google__ClientSecret and Google__TokenEncryptionKey to secret.example.yaml
   > - Google__ClientId, Google__RedirectUri, Google__PostConnectRedirectUrl to configmap.example.yaml
   > - Empty Google: {} placeholders to appsettings.json and appsettings.Development.json
   > - docs/runbooks/google-calendar.md with complete setup, configuration, troubleshooting,
   >   and operational documentation

---

## Testing strategy

**Backend** (`Planner.ApiTests`, xunit + `WebApplicationFactory` over SQLite in-memory —
`EnsureCreated` picks the new tables up automatically). Add a hook to `ApiTestFactory` to
substitute fake `IGoogleOAuthClient` / `IGoogleCalendarClient` implementations; no test ever
touches Google.

1. Default preference is `Local`; Overview output is unchanged from today.
2. `PUT` sources to `Google` with no connection → `400`.
3. `PUT` sources to `Google` while connected but with **zero calendars selected** → `400`. The
   frontend also blocks this, but the server rule must hold on its own.
4. Authorize returns a URL containing a state; the callback with that state creates the
   connection, seeds subscription rows, selects **only** the primary calendar, and upgrades the
   preference to `Both`.
5. Callback with an unknown, expired, or already-consumed state → rejected, no connection row.
6. With `Both` and two calendars selected, events from **both** merge into `todayEvents` in
   start order, all-day flagged, `source = "Google"`, `assignedProfileId = null`, and each
   carrying its own `sourceLabel`.
7. Events from an **unselected** calendar never appear, even though the fake client can serve
   them — the selection is genuinely enforced server-side.
8. `PUT` calendars with an id not belonging to the connection → `400`, selection unchanged.
9. Refreshing the calendar list when Google no longer returns a stored calendar prunes that
   subscription row and drops it from the selection without error.
10. One selected calendar failing while another succeeds → **200**, the healthy calendar's
    events present, `sources.google.status = "Partial"`.
11. Refresh returning `invalid_grant` → `Status = NeedsReauth`, Overview still **200** with
    local events and `sources.google.status = "NeedsReauth"`.
12. Google client throwing/timing out on every calendar → **200**, local events intact, status
    `"Error"`.
13. Disconnect removes the connection, cascades the subscription rows, calls revoke, and resets
    the preference to `Local`.
14. **Reconnect with the same Google account preserves the calendar selection** — tick a second
    calendar, force `NeedsReauth`, reconnect, and assert both calendars are still selected
    rather than reset to primary-only.
15. **Reconnect with a different Google account** (different `sub`) discards the previous
    account's subscription rows and re-seeds primary-only.
16. **Account deletion removes the Google connection.** `POST /api/v1/privacy/account/delete`
    for a connected user leaves no `google_calendar_connections`, `user_calendar_preferences`
    or `google_oauth_states` rows for that `UserId`. Assert directly against the DbContext,
    since no API can see an orphaned row.
17. **Family deletion also removes them** — same assertions via the cascade path, so a
    regression in the FK configuration is caught.
18. Timezone: a family on `America/Los_Angeles` gets today's events from family-local day
    boundaries, and Google is queried with matching `timeMin`/`timeMax`.

**Unit** (`Planner.UnitTests`): cipher round-trip, tamper detection and wrong-key rejection;
PKCE `S256` derivation; Google→domain event mapping for each event shape; and
`UpdateRefreshToken` keeping the stored token when the response omits `refresh_token` while
replacing it when one is present.

**Frontend** (`vitest`, mirroring `src/test/ui-refactor.spec.tsx`): `useGoogleConnectReturn`
redirects `/?googleCalendar=connected` to `/family`, invalidates the three query keys, strips
both params, and renders nothing on a plain `/` visit; the error variant renders a mapped
message for a known `reason` and a generic one for an unknown slug; FamilyPage renders the
selector and the connect/connected/needs-reauth/disconnect states from mocked hooks and hides
the block when unconfigured; the calendar picker lists calendars with checked state, toggles
call the mutation, and clearing the last selection while `Both` is active is blocked with a
message; HomePage renders merged items from two Google calendars with distinct source badges,
the all-day chip, and the reconnect alert on `NeedsReauth`.

**Verification** (per `AGENTS.md`):

```bash
dotnet build planner.sln && dotnet test planner.sln && pnpm --filter @planner/web build && pnpm --filter @planner/web test
```

**Manual end-to-end** (needs real Google credentials): sign in → Family → Connect Google →
consent → land on the base path and get routed to `/family` with a success alert, a clean URL,
and the primary calendar pre-selected → **hard-refresh and confirm the alert does not replay**
→ tick a second calendar → set **Both** → Overview shows local plus both Google
calendars, each badged → untick one and confirm its events disappear → revoke access in the
Google account settings → Overview degrades to local events with a reconnect prompt →
Reconnect → Disconnect.

---

## Reuse rather than duplicate

- `GetMembershipAsync` + `User.GetRequiredUserId()` scoping for every authenticated handler —
  never trust a client-supplied family or user id.
- The consolidated `ResolveTimeZone`/`GetWeekStart` helper from step 1, and
  `CalendarEndpoints`' existing local↔UTC conversion, rather than a fourth copy.
- Existing frontend infrastructure: `http()`, the generated api-client, TanStack Query hook
  conventions, shadcn `Card`/`Select`/`Badge`/`Alert`/`Button`, the profile color-chip helpers,
  and the `/settings/privacy` sub-page pattern if the block outgrows the Family page.
- `Planner.Application` stays a placeholder — no new architectural layer for one feature.
- Leave `apps/web/src/shared/lib/calendar.ts` (`generateGoogleCalendarLink`, ICS export) alone;
  it is an unrelated outbound deep link.

---

## Flag before implementation

1. **Set the OAuth app's audience to "In production" — but do not seek verification.**
   Researched 2026-08-19 against Google's current docs; this supersedes the assumption that
   verification is needed. Calendar scopes are **sensitive**, not **restricted**, so no CASA
   security assessment is ever in play. Google explicitly exempts apps "used by only a few
   users, all of whom are known personally to you" from verification. The decisive detail:

   | | Testing | In production (unverified) |
   |---|---|---|
   | Who can connect | 100 test users, each added by email in the console | Anyone with a Google Account |
   | Consent warning | Yes | Yes (Advanced → Go to (unsafe), once) |
   | **Refresh token life** | **Expires 7 days after consent** | **Indefinite** |
   | Cap | 100 test users | 100 new users, **lifetime, non-resettable** |

   The 7-day refresh-token expiry is a property of **Testing status, not of being unverified**.
   Publishing to production removes it without any review, and also removes the chore of
   listing every family member as a test user. The `NeedsReauth` → Reconnect path stays
   valuable for genuine revocations; it just stops firing weekly.
2. **Google Cloud console setup is a manual prerequisite** — create a **Web application** OAuth
   client, add the `calendar.events.readonly` and `calendar.calendarlist.readonly` scopes, set
   the audience to *In production*, and register `Google:RedirectUri` as an authorized redirect
   URI matching the deployed API exactly
   (`https://…/planner-api/api/v1/integrations/google/callback`, note the `PathBase`). Local dev
   needs a second redirect URI on `localhost:5254`. The GitHub Pages origin is **not** a
   redirect URI and **not** an authorized JavaScript origin — no browser-side Google call ever
   happens, so the split frontend/backend hosting has no effect on the client configuration.
3. **Verifying later is not a free option.** If the app ever outgrows the 100-user cap,
   verification requires the homepage and privacy policy to live on a domain you own and have
   verified in Search Console, and Google does not accept `*.github.io` as first-party. Moving
   the frontend to a custom domain would be a prerequisite. Worth knowing now, not acting on.
4. **The `DashboardEventSummary.Id` GUID→string change is a breaking contract change.** Only
   `HomePage.tsx` consumes it, and the api-client is regenerated in step 9, so the blast radius
   is small — but any offline-cached Overview payload from before the deploy will carry the old
   shape. The render path is tolerant (id is only a React key), so this degrades rather than
   breaks.
5. **Multi-calendar has a latency and quota tail.** Each selected calendar is a separate
   `events.list` call. The 60-second cache and the concurrency-capped fan-out keep the typical
   Overview load to roughly one calendar's latency, but a user who ticks fifteen subscribed
   holiday calendars will feel it and will burn Google API quota faster. If that turns out to
   matter, the mitigations in rough order of effort are: cap the selectable count (say 10),
   lengthen the cache, or move to a background sync that stores Google events locally. I'd
   ship without a cap and add one only if it becomes a real problem.
6. **Offline behaviour.** With `useOfflineQuery`, Google-sourced events will be served from
   IndexedDB while offline, potentially hours stale. Acceptable for an Overview, but if you'd
   rather suppress Google events entirely when offline, that is a small addition to the render
   path.
