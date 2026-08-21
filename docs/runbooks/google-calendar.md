# Google Calendar Integration Runbook

This document covers the setup and operational details for the Google Calendar integration feature.

## Overview

The planner supports connecting user Google Calendar accounts to feed events into the Overview page. This is a server-side OAuth flow - the frontend never sees Google tokens.

- **Feature flag**: The integration self-disables when `Google:ClientId` and `Google:ClientSecret` are not configured.
- **Scope**: Overview page only. The `/calendar` week grid remains local-only.
- **Multi-calendar**: Users can select which of their Google calendars feed the Overview.

## Prerequisites

1. A Google Cloud project with the Calendar API enabled
2. Kubernetes cluster with the planner API deployed
3. PostgreSQL database with the Google Calendar integration tables (migration applied)

## Google Cloud Console Setup

### 1. Create OAuth Client

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth client ID**
5. Select **Web application** as the application type
6. Add authorized JavaScript origins (not used by this integration, but required by Google):
   - For production: `https://mbright77.github.io`
7. Add authorized redirect URIs:
   - For production: `https://<your-api-host>/planner-api/api/v1/integrations/google/callback`
   - For local development: `http://localhost:5254/api/v1/integrations/google/callback`
8. Click **Create**

### 2. Configure OAuth Consent Screen

1. Navigate to **APIs & Services** > **OAuth consent screen**
2. Select **External** user type
3. Fill in required fields:
   - App name: Your app name
   - User support email: Your email
   - Developer contact email: Your email
4. Add the following scopes:
   - `https://www.googleapis.com/auth/calendar.events.readonly`
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
   - `openid`
   - `email`
5. **Important**: Set **Publishing status** to **In production**
   - This removes the 7-day refresh token expiry (Testing status has 7-day expiry)
   - No verification is required for calendar scopes (they are "sensitive", not "restricted")
   - Google explicitly exempts apps "used by only a few users, all of whom are known personally to you" from verification
6. Save changes

### 3. Note Your Credentials

From the Credentials page, note:
- **Client ID** - for `Google:ClientId`
- **Client Secret** - for `Google:ClientSecret`

### 4. Generate Token Encryption Key

The refresh token is encrypted at rest using AES-256-GCM. Generate a 32-byte (256-bit) base64-encoded key:

```bash
# Generate 32 random bytes and base64 encode
openssl rand -base64 32
```

Use this value for `Google:TokenEncryptionKey`.

## Configuration

### Kubernetes (Production)

Update `infra/k8s/planner-api/secret.example.yaml`:

```yaml
stringData:
  # Existing
  ConnectionStrings__Planner: Host=postgres;Port=5432;Database=planner;Username=planner_app;Password=replace-me
  Jwt__SigningKey: replace-me
  
  # Google Calendar integration
  Google__ClientSecret: your-client-secret
  Google__TokenEncryptionKey: your-32-byte-base64-key
```

Update `infra/k8s/planner-api/configmap.example.yaml`:

```yaml
data:
  # Existing
  ASPNETCORE_ENVIRONMENT: Production
  PathBase: /planner-api
  AllowedOrigins: https://mbright77.github.io
  Jwt__Issuer: planner-api
  Jwt__Audience: planner-web
  
  # Google Calendar integration
  Google__ClientId: your-client-id
  Google__RedirectUri: https://<your-api-host>/planner-api/api/v1/integrations/google/callback
  Google__PostConnectRedirectUrl: https://mbright77.github.io/planner/
```

### Local Development

Update `apps/api/src/Planner.Api/appsettings.Development.json`:

```json
{
  "Google": {
    "ClientId": "your-local-client-id",
    "ClientSecret": "your-local-client-secret",
    "RedirectUri": "http://localhost:5254/api/v1/integrations/google/callback",
    "PostConnectRedirectUrl": "http://localhost:5173/",
    "TokenEncryptionKey": "your-32-byte-base64-key"
  }
}
```

## Deployment

1. Apply the updated Secret and ConfigMap to your cluster
2. Restart the API deployment to pick up the new configuration
3. Verify the feature is enabled by checking the `/api/v1/calendar/sources` endpoint returns `"isGoogleConfigured": true`

## User Flow

### First Connection

1. User navigates to Family page
2. Clicks **Connect Google Calendar**
3. Backend creates OAuth state, returns consent URL
4. Frontend redirects to Google consent page
5. User authenticates and grants permissions
6. Google redirects to `/api/v1/integrations/google/callback?code=...&state=...`
7. Backend exchanges code for tokens, creates connection, seeds primary calendar
8. Backend redirects to `/?googleCalendar=connected`
9. Frontend routes to `/family` with success message
10. User sees connected Google account email and can select calendars

### Calendar Selection

- Primary calendar is automatically selected on first connect
- User can show/hide the calendar picker
- User can select/deselect calendars
- Selection is saved immediately
- Deselecting all calendars while Google sources are enabled shows a warning

### Reconnection (Same Account)

If the connection enters `NeedsReauth` state (user revoked access, password changed):

1. User sees **Reconnect** button in Family page
2. Clicking Reconnect starts the OAuth flow again
3. Calendar selection is **preserved** - all previously selected calendars remain selected

### Reconnection (Different Account)

If the user connects a different Google account:

1. Old subscription rows (from previous account) are deleted
2. New connection is created
3. Primary calendar is seeded (not the previous selection)

### Disconnection

1. User clicks **Disconnect** in Family page
2. Backend revokes Google token, deletes connection and subscriptions
3. Preference is reset to `Local`
4. User can connect again at any time

## Troubleshooting

### "Google integration is not configured"

The API returns this error when `Google:ClientId` or `Google:ClientSecret` are empty/missing. Verify your configuration.

### Callback redirects to error page

Check the `reason` query parameter for the specific error:

| Reason | Cause |
|--------|-------|
| `invalid_request` | Missing code or state in callback |
| `invalid_state` | State not found or already consumed |
| `expired_state` | State expired (10-minute TTL) |
| `token_exchange_failed` | Failed to exchange code for tokens |
| `missing_identity` | Could not parse id_token |
| `membership_not_found` | User's family membership not found |
| `connection_conflict` | Concurrent connection attempts |

### Events not appearing from Google

1. Verify the user has selected at least one calendar in Family page
2. Verify the source preference is set to `Google` or `Both`
3. Check the Overview response `sources.google.status`:
   - `"Ok"` - All selected calendars loaded successfully
   - `"Partial"` - Some calendars failed (check `failedCalendarNames`)
   - `"NeedsReauth"` - Connection expired, user must reconnect
   - `"Error"` - Google API error
4. Check API logs for Google API errors

### Refresh token issues

- Google does not guarantee a refresh token on every token response
- The backend preserves the existing refresh token when Google omits it
- If refresh fails with `invalid_grant`, the connection status is set to `NeedsReauth`
- The user must click **Reconnect** to grant access again

## Capacity Limits

- Each selected calendar = one `events.list` API call
- Concurrency cap: 4 parallel calendar fetches
- Cache: 60 seconds per (connection, week, selection) combination
- Google API quota: ~100,000 requests per 100 seconds per project (Calendar API)

For users with many calendars, consider:
1. Capping the selectable count (not currently implemented)
2. Lengthening the cache TTL
3. Moving to background sync that stores Google events locally

## Security Notes

- Refresh tokens are encrypted at rest using AES-256-GCM
- Access tokens are cached in memory (not persisted) with TTL
- The frontend never sees any Google tokens
- OAuth state is single-use, hashed at rest, with 10-minute TTL
- PKCE is used to prevent code interception
- Token values are never logged

## Migration

The Google Calendar integration requires the following database tables (created by EF migration):

- `user_calendar_preferences`
- `google_calendar_connections`
- `google_calendar_subscriptions`
- `google_oauth_states`

Ensure the migration has been applied before enabling the feature.

## Cleanup on Account/Family Deletion

- **Family deletion**: All Google Calendar data is automatically deleted via cascade (connection, subscriptions, preferences)
- **Account deletion**: The backend explicitly deletes the user's connection, preferences, and OAuth states before deleting the Identity user

## References

- [Google OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Calendar API](https://developers.google.com/calendar/api)
- [PKCE for OAuth](https://datatracker.ietf.org/doc/html/rfc7636)
