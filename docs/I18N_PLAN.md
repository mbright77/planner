# i18n Plan: English + Swedish Language Support

## Overview

Add full internationalisation (i18n) support to the Family Planner frontend using
`react-i18next` with static JSON translation files. Users can select their preferred
language (English or Swedish) on their own profile card in the Family page. The
preference is stored on the `Profile` record in the database and applied automatically
on every login.

---

## Constraints and Decisions

| Decision | Choice | Rationale |
|---|---|---|
| i18n library | `react-i18next` + `i18next` | Industry standard, excellent plural/interpolation support, no build-time compilation needed |
| Translation file format | Static JSON, one file per feature namespace | Mirrors the feature-folder layout of the frontend; easy to diff and review |
| Language storage | `Profile.PreferredLanguage` (`string?`, IETF BCP 47) | Follows existing convention of user-linked settings on `Profile` |
| Language selector location | Profile card on `FamilyPage`, own profile only | Keeps settings close to profile identity; avoids a separate settings page |
| Fallback for unlinked profiles | Family admin's `preferredLanguage`, then `"en"` | Consistent family experience for members without a login |
| Date/time locale formatting | Out of scope | `toLocaleDateString` calls remain unchanged |
| Bootstrap exposure | Add `PreferredLanguage` to `ProfileSummary` | Allows the frontend to resolve fallback language without an extra API call |

---

## Phase 1 — Backend

### 1.1 Domain entity

File: `apps/api/src/Planner.Domain/AssemblyMarker.cs`

Add to the `Profile` class:

```csharp
public string? PreferredLanguage { get; set; } // IETF BCP 47: "en" | "sv"
```

### 1.2 EF configuration

File: `apps/api/src/Planner.Infrastructure/Persistence/Configurations/ProfileConfiguration.cs`

Add:

```csharp
builder.Property(x => x.PreferredLanguage).HasMaxLength(10);
```

### 1.3 Contracts

File: `apps/api/src/Planner.Contracts/Profiles/ProfileContracts.cs`

- `ProfileResponse` — add `string? PreferredLanguage`
- `CreateProfileRequest` — add `string? PreferredLanguage = null`
- `UpdateProfileRequest` — add `string? PreferredLanguage = null`

File: `apps/api/src/Planner.Contracts/Bootstrap/BootstrapContracts.cs`

- `ProfileSummary` — add `string? PreferredLanguage`

### 1.4 Endpoints

File: `apps/api/src/Planner.Api/Endpoints/ProfileEndpoints.cs`

- GET projection: include `x.PreferredLanguage` in `ProfileResponse` constructor
- POST: set `PreferredLanguage = request.PreferredLanguage?.Trim()`
- PUT: set `profile.PreferredLanguage = request.PreferredLanguage?.Trim()`

File: `apps/api/src/Planner.Api/Endpoints/BootstrapEndpoints.cs`

- Include `PreferredLanguage` in the `ProfileSummary` projection

### 1.5 Migration

```bash
dotnet tool restore
dotnet dotnet-ef migrations add AddProfilePreferredLanguage \
  --project apps/api/src/Planner.Infrastructure/Planner.Infrastructure.csproj \
  --startup-project apps/api/src/Planner.Api/Planner.Api.csproj \
  --output-dir Persistence/Migrations
dotnet dotnet-ef database update \
  --project apps/api/src/Planner.Infrastructure/Planner.Infrastructure.csproj \
  --startup-project apps/api/src/Planner.Api/Planner.Api.csproj
```

### 1.6 Regenerate TypeScript API client

```bash
cd packages/api-client && node ./scripts/generate.mjs
```

---

## Phase 2 — Frontend Infrastructure

### 2.1 Install dependencies

```bash
pnpm --filter @planner/web add react-i18next i18next
```

### 2.2 Translation file structure

```
apps/web/src/shared/i18n/
├── i18n.ts                       ← i18next initialisation
├── useAppLanguage.ts             ← hook: resolves and applies language from bootstrap
└── locales/
    ├── en/
    │   ├── common.json           ← nav, buttons, offline banners, color labels
    │   ├── auth.json             ← LoginPage, InvitePage
    │   ├── home.json             ← HomePage / Dashboard
    │   ├── calendar.json         ← CalendarPage + event sheet
    │   ├── meals.json            ← MealsPage + meal sheet + requests
    │   ├── shopping.json         ← ShoppingPage + item sheet
    │   └── family.json           ← FamilyPage + PrivacyPage
    └── sv/
        ├── common.json
        ├── auth.json
        ├── home.json
        ├── calendar.json
        ├── meals.json
        ├── shopping.json
        └── family.json
```

### 2.3 `i18n.ts` configuration

```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
// import all 14 namespace JSON files...

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'sv'],
  defaultNS: 'common',
  ns: ['common', 'auth', 'home', 'calendar', 'meals', 'shopping', 'family'],
  resources: {
    en: { common: enCommon, auth: enAuth, /* ... */ },
    sv: { common: svCommon, auth: svAuth, /* ... */ },
  },
  interpolation: { escapeValue: false }, // React handles XSS
})

export default i18n
```

### 2.4 Wire provider

File: `apps/web/src/app/providers/AppProviders.tsx`

- Side-effect import of `./../../shared/i18n/i18n`
- Wrap the component tree with `I18nextProvider i18n={i18n}`

### 2.5 `useAppLanguage.ts`

Called once inside `AppShell`. Resolution order:

1. Get bootstrap data via `useBootstrap()`
2. Find the profile whose `linkedUserId` matches `membership.userId` → use their `preferredLanguage`
3. If null, find the profile linked to the Admin-role membership → use their `preferredLanguage`
4. If still null, fall back to `"en"`
5. `useEffect` calls `i18n.changeLanguage(resolved)` whenever bootstrap data changes

---

## Phase 3 — Replace Hard-Coded Strings

Each file uses `const { t } = useTranslation('namespace')`.

| File | Namespace |
|---|---|
| `app/layouts/AppShell.tsx` | `common` |
| `pages/login/LoginPage.tsx` | `auth` |
| `pages/invite/InvitePage.tsx` | `auth` |
| `pages/home/HomePage.tsx` | `home` |
| `pages/calendar/CalendarPage.tsx` | `calendar` |
| `pages/meals/MealsPage.tsx` | `meals` |
| `pages/shopping/ShoppingPage.tsx` | `shopping` |
| `pages/family/FamilyPage.tsx` | `family` |
| `pages/privacy/PrivacyPage.tsx` | `family` |

### Interpolation pattern

```tsx
// Before
`Assigned to ${name}`
// JSON key: "assignedTo": "Assigned to {{name}}"
t('assignedTo', { name })
```

### Pluralisation pattern

i18next resolves `_one` / `_other` key suffixes automatically when `count` is passed.

```tsx
// Before
`${n} item(s) left`
// JSON keys: "itemsLeft_one": "{{count}} item left"
//            "itemsLeft_other": "{{count}} items left"
t('itemsLeft', { count: n })
```

---

## Phase 4 — Language Selector on FamilyPage

- Render a `<select>` inside the profile card
- **Visibility condition**: `profile.linkedUserId === membership.userId` (own profile only)
- Options: `English` (value `"en"`) / `Svenska` (value `"sv"`)
- `onChange`: calls `updateProfile` mutation with the new `preferredLanguage`
- Language switches immediately via `useAppLanguage` reacting to the updated bootstrap cache
- No page reload required
- Label key in `family.json`: `"preferredLanguage"` → `"Language"` / `"Språk"`

---

## Phase 5 — Translation Content Reference

### `common.json`

| Key | English | Swedish |
|---|---|---|
| `nav.home` | Home | Hem |
| `nav.calendar` | Calendar | Kalender |
| `nav.meals` | Meals | Mat |
| `nav.shopping` | Shopping | Shopping |
| `nav.family` | Family | Familj |
| `signOut` | Sign out | Logga ut |
| `loading` | Loading... | Laddar... |
| `cancel` | Cancel | Avbryt |
| `save` | Save | Spara |
| `saving` | Saving... | Sparar... |
| `delete` | Delete | Radera |
| `confirmDelete` | Confirm delete | Bekräfta radering |
| `close` | Close | Stäng |
| `previous` | Previous | Föregående |
| `next` | Next | Nästa |
| `unassigned` | Unassigned | Otilldelad |
| `color.green` | Green | Grön |
| `color.blue` | Blue | Blå |
| `color.pink` | Pink | Rosa |
| `color.yellow` | Yellow | Gul |
| `offline.active` | Offline mode: showing cached planner data when available. | Offlineläge: visar cachad planeringsdata när tillgänglig. |
| `offline.syncing_one` | Syncing {{count}} offline change... | Synkroniserar {{count}} offlineändring... |
| `offline.syncing_other` | Syncing {{count}} offline changes... | Synkroniserar {{count}} offlineändringar... |
| `offline.waiting_one` | {{count}} offline change waiting to sync. | {{count}} offlineändring väntar på synkronisering. |
| `offline.waiting_other` | {{count}} offline changes waiting to sync. | {{count}} offlineändringar väntar på synkronisering. |
| `offline.attention_one` | Offline sync needs attention for {{count}} change. | Offlinesynk kräver åtgärd för {{count}} ändring. |
| `offline.attention_other` | Offline sync needs attention for {{count}} changes. | Offlinesynk kräver åtgärd för {{count}} ändringar. |
| `bootstrap.loading` | Loading family data... | Laddar familjedata... |
| `bootstrap.error` | Unable to load bootstrap data. Try signing in again. | Det gick inte att ladda data. Försök logga in igen. |

### `auth.json`

| Key | English | Swedish |
|---|---|---|
| `eyebrow` | Family planner | Familjeplanner |
| `tagline` | Keep the week in sync | Håll veckan synkad |
| `subtext` | Sign in to your shared planner or create a family workspace with calendars, meals, shopping, and profiles. | Logga in på din delade planner eller skapa en familjearbetsyta med kalendrar, mat, shopping och profiler. |
| `tabs.signIn` | Sign in | Logga in |
| `tabs.createFamily` | Create family | Skapa familj |
| `fields.email` | Email | E-post |
| `fields.password` | Password | Lösenord |
| `fields.familyName` | Family name | Familjenamn |
| `fields.displayName` | Your display name | Ditt visningsnamn |
| `fields.timezone` | Timezone | Tidszon |
| `fields.profileColor` | Profile color | Profilfärg |
| `submit.signIn` | Sign in | Logga in |
| `submit.createFamily` | Create family | Skapa familj |
| `submit.saving` | Saving... | Sparar... |
| `errors.signIn` | Unable to sign in with those details. | Det gick inte att logga in med dessa uppgifter. |
| `errors.createFamily` | Unable to create your family account. | Det gick inte att skapa familjekontot. |
| `invite.eyebrow` | Invitation | Inbjudan |
| `invite.heading` | Join a family | Gå med i en familj |
| `invite.loading` | Loading invite... | Laddar inbjudan... |
| `invite.join` | Join {{familyName}} with the invite sent to {{email}}. | Gå med i {{familyName}} med inbjudan skickad till {{email}}. |
| `invite.linkedProfile` | This invite will connect your sign-in to the existing profile {{name}}. | Denna inbjudan kopplar din inloggning till den befintliga profilen {{name}}. |
| `invite.expired` | This invite has expired. | Denna inbjudan har gått ut. |
| `invite.alreadyAccepted` | This invite has already been accepted. | Denna inbjudan har redan accepterats. |
| `invite.submit` | Join family | Gå med i familj |
| `invite.submitting` | Joining... | Går med... |
| `invite.errors.load` | Unable to load this invite. | Det gick inte att ladda inbjudan. |
| `invite.errors.accept` | Unable to accept this invite. | Det gick inte att acceptera inbjudan. |

### `home.json`

| Key | English | Swedish |
|---|---|---|
| `greeting.morning` | Good morning, team | God morgon, team |
| `greeting.afternoon` | Good afternoon, team | God eftermiddag, team |
| `greeting.evening` | Good evening, team | God kväll, team |
| `loading` | Loading dashboard... | Laddar instrumentpanel... |
| `error` | Unable to load the dashboard overview. | Det gick inte att ladda översikten. |
| `todaySection` | Today's Fun | Dagens aktiviteter |
| `emptyToday` | Nothing planned today - enjoy the day! | Inget planerat idag – njut av dagen! |
| `dinner` | Dinner | Middag |
| `noDinner` | No dinner plan yet | Ingen middagsplan ännu |
| `dinnerCta` | Open Meals to plan tonight. | Öppna Mat för att planera ikväll. |
| `groceries` | Groceries | Livsmedel |
| `itemsLeft_one` | {{count}} item left | {{count}} vara kvar |
| `itemsLeft_other` | {{count}} items left | {{count}} varor kvar |
| `emptyList` | List is clear right now. | Listan är tom just nu. |
| `assignedFallback` | Family | Familj |

### `calendar.json`

| Key | English | Swedish |
|---|---|---|
| `heading` | Weekly planner | Veckoplanner |
| `subtext` | Pick a day first, then add or edit events in a focused mobile sheet. | Välj en dag först och lägg sedan till eller redigera händelser. |
| `loading` | Loading weekly calendar... | Laddar veckans kalender... |
| `error` | Unable to load weekly events. | Det gick inte att ladda veckans händelser. |
| `addEvent` | Add event | Lägg till händelse |
| `addHere` | Add here | Lägg till här |
| `editEvent` | Edit event | Redigera händelse |
| `emptyDay` | No events yet for this day. | Inga händelser för denna dag. |
| `lightDay` | Keep this day light or use the add action above to plan something now. | Håll denna dag lugn eller använd knappen ovan för att planera något. |
| `eventCount_one` | {{count}} event planned | {{count}} händelse planerad |
| `eventCount_other` | {{count}} events planned | {{count}} händelser planerade |
| `repeatsWeekly` | Repeats weekly through {{date}} | Upprepas varje vecka till {{date}} |
| `assignedTo` | Assigned to {{name}} | Tilldelad {{name}} |
| `updateFutureRepeats` | Update future repeats | Uppdatera framtida upprepningar |
| `updateFutureRepeatsHint` | Apply edits to the rest of this recurring series. | Tillämpa ändringar på resten av denna upprepande serie. |
| `fields.title` | Title | Titel |
| `fields.titlePlaceholder` | Add event title | Lägg till händelsetitel |
| `fields.startTime` | Start time | Starttid |
| `fields.endTime` | End time | Sluttid |
| `fields.assignedProfile` | Assigned profile | Tilldelad profil |
| `fields.repeatWeekly` | Repeat weekly | Upprepa varje vecka |
| `fields.repeatUntil` | Repeat until | Upprepa till |
| `fields.notes` | Notes | Anteckningar |
| `showExtra` | Show extra details | Visa extra detaljer |
| `hideExtra` | Hide extra details | Dölj extra detaljer |
| `actions.addToCalendar` | Add to calendar | Lägg till i kalender |
| `actions.edit` | Edit | Redigera |
| `actions.delete` | Delete | Radera |
| `errors.title` | Add a short event title before saving. | Ange en kort händelsetitel innan du sparar. |
| `errors.time` | Choose a valid start and end time. | Välj en giltig start- och sluttid. |
| `errors.endTime` | End time needs to be after the start time. | Sluttid måste vara efter starttid. |

### `meals.json`

| Key | English | Swedish |
|---|---|---|
| `heading` | Weekly meals | Veckans mat |
| `subtext` | Pick a day first, then plan dinner or capture a request while that day is in view. | Välj en dag och planera sedan middag eller skicka ett önskemål. |
| `weekMeta` | One dinner plan per day, visible to the whole family. | En middagsplan per dag, synlig för hela familjen. |
| `readOnly` | Your profile is excluded from planning, so you can request meals but not plan or accept them. | Din profil är exkluderad från planering – du kan önska mat men inte planera eller acceptera. |
| `loading` | Loading weekly meals... | Laddar veckans mat... |
| `error` | Unable to load weekly meals. | Det gick inte att ladda veckans mat. |
| `noMeal` | No meal planned yet. | Ingen middag planerad ännu. |
| `status.mealSet` | Meal set | Middag satt |
| `status.requests_one` | {{count}} request | {{count}} önskemål |
| `status.requests_other` | {{count}} requests | {{count}} önskemål |
| `status.open` | Open | Öppen |
| `editDinner` | Edit dinner | Redigera middag |
| `planDinner` | Plan dinner | Planera middag |
| `fields.mealTitle` | Meal title | Middagstitel |
| `fields.mealTitlePlaceholder` | Plan dinner | Planera middag |
| `fields.owner` | Owner | Ansvarig |
| `fields.notes` | Notes | Anteckningar |
| `moreOptions` | More options | Fler alternativ |
| `fewerFields` | Fewer fields | Färre fält |
| `saveCreate` | Save dinner for {{date}} | Spara middag för {{date}} |
| `saveEdit` | Save changes for {{date}} | Spara ändringar för {{date}} |
| `actions.editDay` | Edit day | Redigera dag |
| `actions.planDay` | Plan this day | Planera denna dag |
| `actions.requestMeal` | Request meal | Önska mat |
| `requests.eyebrow` | Requests | Önskemål |
| `requests.heading` | Meal requests for {{date}} | Matönskemål för {{date}} |
| `requests.toggle` | Request meal | Önska mat |
| `requests.hide` | Hide request form | Dölj önskemålsformulär |
| `requests.loading` | Loading meal requests... | Laddar matönskemål... |
| `requests.error` | Unable to load meal requests. | Det gick inte att ladda matönskemål. |
| `requests.empty` | No requests are waiting for this day. | Inga önskemål väntar för denna dag. |
| `requests.fields.title` | Request title | Önskemålstitel |
| `requests.fields.titlePlaceholder` | Request a meal idea | Önska en matidé |
| `requests.fields.notes` | Notes | Anteckningar |
| `requests.fields.assign` | Assign person | Tilldela person |
| `requests.submit` | Add request for {{date}} | Lägg till önskemål för {{date}} |
| `requests.actions.saveAssignment` | Save assignment | Spara tilldelning |
| `requests.actions.accept` | Accept | Acceptera |
| `errors.createTitle` | Add a dinner title before saving. | Ange en middagstitel innan du sparar. |
| `errors.editTitle` | Add a dinner title before saving changes. | Ange en middagstitel innan du sparar ändringar. |
| `errors.requestTitle` | Add a short request before sending it. | Ange ett kort önskemål innan du skickar det. |

### `shopping.json`

| Key | English | Swedish |
|---|---|---|
| `heading` | Shared list | Gemensam lista |
| `subtext` | Quickly add items, group them by category, and mark them complete during the shop. | Lägg snabbt till varor, gruppera dem efter kategori och markera dem som klara under inköpet. |
| `quickAdd.eyebrow` | Quick add | Snabblägg till |
| `quickAdd.heading` | Keep grocery capture one tap away | Håll varufångst ett tryck bort |
| `quickAdd.meta` | Use the floating action button or the add action below to open the item sheet. | Använd den flytande knappen eller lägg-till-åtgärden nedan för att öppna varubladet. |
| `addItem` | Add item | Lägg till vara |
| `loading` | Loading shopping list... | Laddar inköpslistan... |
| `error` | Unable to load shopping items. | Det gick inte att ladda inköpsvaror. |
| `empty` | Your shared list is clear. Add the next item when it comes to mind. | Din gemensamma lista är tom. Lägg till nästa vara när du kommer på det. |
| `remove` | Remove | Ta bort |
| `sheet.eyebrow` | Quick add | Snabblägg till |
| `sheet.heading` | Add shopping item | Lägg till inköpsvara |
| `fields.itemName` | Item name | Varunamn |
| `fields.itemNamePlaceholder` | Add item (e.g., Milk) | Lägg till vara (t.ex. Mjölk) |
| `fields.category` | Category | Kategori |
| `fields.addedBy` | Added by | Tillagd av |
| `showExtra` | Show extra details | Visa extra detaljer |
| `hideExtra` | Hide extra details | Dölj extra detaljer |
| `categories.produce` | Produce | Frukt & grönt |
| `categories.dairy` | Dairy | Mejeri |
| `categories.pantry` | Pantry | Skafferi |
| `categories.household` | Household | Hushåll |
| `errors.itemName` | Add an item name before saving. | Ange ett varunamn innan du sparar. |

### `family.json`

| Key | English | Swedish |
|---|---|---|
| `heading` | Profiles and colors | Profiler och färger |
| `subtext` | Manage the family members used across the planner and keep their color keys consistent. | Hantera familjemedlemmar som används i plannern och håll deras färgnycklar konsekventa. |
| `privacyLink` | Review deletion and privacy options | Granska alternativ för radering och integritet |
| `preferredLanguage` | Language | Språk |
| `lang.en` | English | English |
| `lang.sv` | Svenska | Svenska |
| `fields.displayName` | Display name | Visningsnamn |
| `fields.colorKey` | Color key | Färgnyckel |
| `fields.namePlaceholder` | Add a family member | Lägg till en familjemedlem |
| `addMember` | + Add new member | + Lägg till ny medlem |
| `profile.eyebrow` | Profile | Profil |
| `profile.active` | Active member | Aktiv medlem |
| `profile.inactive` | Inactive member | Inaktiv medlem |
| `profile.activeBadge` | Active | Aktiv |
| `profile.stats.status` | Status | Status |
| `profile.stats.colorIdentity` | Color identity | Färgidentitet |
| `profile.stats.signInAccess` | Sign-in access | Inloggningsåtkomst |
| `profile.stats.statusActive` | Active | Aktiv |
| `profile.stats.statusInactive` | Inactive | Inaktiv |
| `profile.stats.hasLogin` | Has login | Har inloggning |
| `profile.stats.profileOnly` | Profile only | Endast profil |
| `profile.toggle.includedLabel` | Included in planning | Inkluderad i planering |
| `profile.toggle.hiddenLabel` | Hidden from planning | Dold från planering |
| `profile.toggle.activeHint` | This member can appear in planning flows and assignments. | Denna medlem kan visas i planeringsflöden och tilldelningar. |
| `profile.toggle.inactiveHint` | This member stays available for sign-in, requests, and shopping updates only. | Denna medlem är tillgänglig för inloggning, önskemål och shoppinguppdateringar. |
| `loading` | Loading profiles... | Laddar profiler... |
| `error` | Unable to load profiles. | Det gick inte att ladda profiler. |
| `invites.eyebrow` | Invites | Inbjudningar |
| `invites.heading` | Invite a family member | Bjud in en familjemedlem |
| `invites.description` | Invited family members can sign in, view the shared planner, add calendar items, request and plan meals, and update shopping. | Inbjudna familjemedlemmar kan logga in, visa den delade plannern, lägga till kalenderhändelser, önska och planera mat samt uppdatera shopping. |
| `invites.fields.email` | Email | E-post |
| `invites.fields.emailPlaceholder` | name@example.com | namn@example.com |
| `invites.fields.linkProfile` | Link to existing profile (optional) | Länka till befintlig profil (valfritt) |
| `invites.fields.newProfile` | New profile | Ny profil |
| `invites.submit` | Create invite link | Skapa inbjudningslänk |
| `invites.submitting` | Creating... | Skapar... |
| `invites.helper` | Use this when someone already appears in your planner and now needs sign-in access. | Använd detta när någon redan finns i din planner och nu behöver inloggningsåtkomst. |
| `invites.linkedTo` | Linked to {{name}} | Länkad till {{name}} |
| `invites.expires` | Expires {{date}} | Går ut {{date}} |
| `invites.status.accepted` | Accepted | Accepterad |
| `invites.status.pending` | Pending | Väntande |
| `invites.loading` | Loading invites... | Laddar inbjudningar... |
| `invites.error` | Unable to load invites. | Det gick inte att ladda inbjudningar. |
| `privacy.heading` | Deletion and privacy | Radering och integritet |
| `privacy.subtext` | Confirm destructive actions with your password. These flows are designed for permanent cleanup. | Bekräfta destruktiva åtgärder med ditt lösenord. Dessa flöden är utformade för permanent rensning. |
| `privacy.deleteAccount.heading` | Delete my account | Radera mitt konto |
| `privacy.deleteAccount.description` | Leave the planner and remove your account. This is blocked if you are the only family member. | Lämna plannern och ta bort ditt konto. Detta är blockerat om du är den enda familjemedlemmen. |
| `privacy.deleteAccount.submit` | Delete my account | Radera mitt konto |
| `privacy.deleteAccount.submitting` | Deleting... | Raderar... |
| `privacy.deleteAccount.error` | Unable to delete account. | Det gick inte att radera kontot. |
| `privacy.deleteFamily.heading` | Delete family | Radera familj |
| `privacy.deleteFamily.description` | Remove the entire family planner, including profiles, invites, events, meals, and shopping data. | Ta bort hela familjeplannern, inklusive profiler, inbjudningar, händelser, mat och shoppingdata. |
| `privacy.deleteFamily.submit` | Delete family | Radera familj |
| `privacy.deleteFamily.submitting` | Deleting... | Raderar... |
| `privacy.deleteFamily.error` | Unable to delete family. | Det gick inte att radera familjen. |
| `privacy.back` | Back to family settings | Tillbaka till familjeinställningar |
| `privacy.fields.password` | Password | Lösenord |

---

## Phase 6 — Verification Checklist

- [ ] `dotnet build planner.sln` passes
- [ ] `dotnet test planner.sln` passes
- [ ] `pnpm --filter @planner/web build` passes
- [ ] Switching language on the profile card updates the UI without a page reload
- [ ] Logging out and back in restores the saved language
- [ ] Profiles with no linked login see the family admin's language
- [ ] Fallback to `"en"` works when no admin preference is set
- [ ] No hard-coded English strings remain in any page component
- [ ] All pluralisation cases render correctly in both locales
- [ ] All interpolated strings render correctly in both locales

---

## Files Changed Summary

### Backend

| File | Change |
|---|---|
| `Planner.Domain/AssemblyMarker.cs` | Add `PreferredLanguage` to `Profile` |
| `Planner.Infrastructure/Persistence/Configurations/ProfileConfiguration.cs` | Add column config |
| `Planner.Contracts/Profiles/ProfileContracts.cs` | Add field to all three contract records |
| `Planner.Contracts/Bootstrap/BootstrapContracts.cs` | Add field to `ProfileSummary` |
| `Planner.Api/Endpoints/ProfileEndpoints.cs` | Wire field into GET/POST/PUT |
| `Planner.Api/Endpoints/BootstrapEndpoints.cs` | Include field in `ProfileSummary` projection |
| `Planner.Infrastructure/Persistence/Migrations/` | New migration (generated) |
| `packages/api-client/src/generated.ts` | Regenerated |

### Frontend

| File | Change |
|---|---|
| `apps/web/package.json` | Add `react-i18next`, `i18next` |
| `apps/web/src/shared/i18n/i18n.ts` | New — i18next configuration |
| `apps/web/src/shared/i18n/useAppLanguage.ts` | New — language resolution hook |
| `apps/web/src/shared/i18n/locales/en/*.json` | New — 7 English namespace files |
| `apps/web/src/shared/i18n/locales/sv/*.json` | New — 7 Swedish namespace files |
| `apps/web/src/app/providers/AppProviders.tsx` | Add `I18nextProvider` |
| `apps/web/src/app/layouts/AppShell.tsx` | Replace strings, call `useAppLanguage` |
| `apps/web/src/pages/login/LoginPage.tsx` | Replace strings |
| `apps/web/src/pages/invite/InvitePage.tsx` | Replace strings |
| `apps/web/src/pages/home/HomePage.tsx` | Replace strings |
| `apps/web/src/pages/calendar/CalendarPage.tsx` | Replace strings |
| `apps/web/src/pages/meals/MealsPage.tsx` | Replace strings |
| `apps/web/src/pages/shopping/ShoppingPage.tsx` | Replace strings |
| `apps/web/src/pages/family/FamilyPage.tsx` | Replace strings + add language selector |
| `apps/web/src/pages/privacy/PrivacyPage.tsx` | Replace strings |
