# Auth0 Configuration — GitHub + Passwordless Email + Google Calendar

This guide covers the Auth0 Dashboard configuration required for the Waypoint login page to work with **GitHub social login**, **Passwordless email (OTP)** sign-in, and **Google Calendar integration** (account linking).

---

## 1. Enable GitHub Social Connection

1. Go to **Auth0 Dashboard → Authentication → Social**
2. Click **Create Connection** → select **GitHub**
3. Enter your GitHub OAuth app credentials:
   - **Client ID**: from GitHub Developer Settings → OAuth Apps
   - **Client Secret**: from the same GitHub OAuth app
4. Under **Permissions**, ensure `read:user` and `user:email` are checked
5. Click **Create**
6. On the connection page, go to the **Applications** tab and **enable it for your Waypoint application** (`Sob557lAYKvQy1BI6RLzZd4IXttuVwT6`)

### Creating a GitHub OAuth App

1. Go to https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**
2. Fill in:
   - **Application name**: Waypoint
   - **Homepage URL**: `http://localhost:3000` (or your production URL)
   - **Authorization callback URL**: `https://dev-bbp4run0t8tlr2qd.us.auth0.com/login/callback`
3. Copy the Client ID and Client Secret into Auth0

---

## 2. Enable Passwordless Email Connection (PIPEDA Compliance)

Passwordless authentication stores no user passwords, reducing the personal data footprint and aligning with PIPEDA's data minimization principle.

1. Go to **Auth0 Dashboard → Authentication → Passwordless**
2. Click **Email** to enable it
3. Configure:
   - **From**: your sender email (e.g., `noreply@waypoint.app`)
   - **Subject**: `Your Waypoint sign-in code`
   - **OTP Length**: 6 (default)
   - **OTP Expiry**: 300 seconds (5 minutes)
4. Under **Applications**, enable it for your Waypoint application
5. Optionally customize the email template to match your branding

> **Note**: The connection name for passwordless email in Auth0 is `email`. The login page uses `/auth/login?connection=email` to trigger this flow.

---

## 3. Enable Google Social Connection (Calendar Integration)

Google is used as a **linked account** for Calendar sync — not as a primary login method. Users sign in with GitHub or Passwordless email first, then link their Google account from the Profile page to enable two-way calendar sync.

### Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select your existing one
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client IDs**
5. Configure the consent screen:
   - **App name**: Waypoint
   - **User support email**: your email
   - **Scopes**: Add `https://www.googleapis.com/auth/calendar.events`
   - **Authorized domains**: `auth0.com`
6. Create the OAuth client:
   - **Application type**: Web application
   - **Name**: Waypoint Auth0
   - **Authorized redirect URIs**: `https://dev-bbp4run0t8tlr2qd.us.auth0.com/login/callback`
7. Copy the **Client ID** and **Client Secret**

### Step 2: Enable Google API

1. In Google Cloud Console → **APIs & Services → Library**
2. Search for **Google Calendar API** and **Enable** it

### Step 3: Configure Auth0 Google Connection

1. Go to **Auth0 Dashboard → Authentication → Social**
2. Click **Create Connection → Google / Gmail**
3. Enter:
   - **Client ID**: from Google Cloud Console
   - **Client Secret**: from Google Cloud Console
4. Under **Permissions**, check these scopes:
   - ✅ `email`
   - ✅ `profile`
   - ✅ `https://www.googleapis.com/auth/calendar.events`
5. Under **Advanced Settings**:
   - Enable **"Sync user profile attributes at each login"**
   - Enable **"Pass Access Token, ID Token, and 'openid' and 'email' scopes used by your app to the Identity Provider"**
6. **CRITICAL — Request offline access** (required for refresh tokens):
   - In the Google connection settings → scroll to **"Custom Parameters"** (or Advanced → OAuth2)
   - Add parameter: `access_type` = `offline`
   - Add parameter: `prompt` = `consent`
   - This ensures Google issues a **refresh token** so Waypoint can sync events even when the user is not actively logged in
7. Click **Create** (or **Save**)
8. Go to the **Applications** tab and enable for your Waypoint application

### Step 4: Enable Account Linking

This allows users who signed up with GitHub or Email to also link Google without creating a separate account.

**Option A — Automatic Account Linking (Recommended)**:

1. Go to **Auth0 Dashboard → Actions → Library → Build Custom**
2. Create a new action called `Auto Link Accounts by Email`
3. Paste this code:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const { ManagementClient } = require("auth0");

  // Only run when a user logs in with a secondary identity (e.g., Google after GitHub)
  if (event.user.identities.length > 1) return; // Already linked

  const management = new ManagementClient({
    domain: event.secrets.domain,
    clientId: event.secrets.clientId,
    clientSecret: event.secrets.clientSecret,
  });

  // Search for existing users with the same email
  const existingUsers = await management.usersByEmail.getByEmail({
    email: event.user.email,
  });

  // Find a primary user that is NOT the current login identity
  const primaryUser = existingUsers.data.find(
    (u) =>
      u.user_id !== event.user.user_id &&
      u.email_verified
  );

  if (primaryUser) {
    // Link this new identity to the existing primary account
    const [provider, userId] = event.user.user_id.split("|");
    await management.users.link(
      { id: primaryUser.user_id },
      { provider, user_id: userId }
    );

    // Update the primary user ID so Auth0 returns the linked profile
    api.authentication.setPrimaryUser(primaryUser.user_id);
  }
};
```

4. Go to **Settings → Secrets** and add:
   - `domain`: `dev-bbp4run0t8tlr2qd.us.auth0.com`
   - `clientId`: Your Auth0 **Machine-to-Machine** app Client ID (create one if needed via Applications → Create → M2M → authorize for Management API with `read:users`, `update:users` permissions)
   - `clientSecret`: The same M2M app's Client Secret
5. **Deploy** the action
6. Go to **Actions → Flows → Login** and **drag** your `Auto Link Accounts by Email` action into the flow

> **How it works**: When a user signs in with Google and their email already has a GitHub or Passwordless account, Auth0 automatically links the Google identity to the existing account instead of creating a new one.

### Step 5: Retrieve Google Tokens in Callback

Auth0 stores the upstream Google tokens on the user's identity. To access them at login:

1. Go to **Auth0 Dashboard → Actions → Library → Build Custom**
2. Create a new action called `Pass Google Tokens to App`:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const { ManagementClient } = require("auth0");

  // We need the Management API to read the full identity (including tokens)
  // because event.user.identities does NOT include access_token / refresh_token
  const management = new ManagementClient({
    domain: event.secrets.domain,
    clientId: event.secrets.clientId,
    clientSecret: event.secrets.clientSecret,
  });

  // Fetch the full user profile with identities
  const { data: fullUser } = await management.users.get({
    id: event.user.user_id,
  });

  const googleIdentity = fullUser?.identities?.find(
    (i) => i.provider === "google-oauth2"
  );

  if (googleIdentity) {
    const namespace = "https://waypoint.app";
    if (googleIdentity.access_token) {
      api.idToken.setCustomClaim(`${namespace}/google_access_token`, googleIdentity.access_token);
    }
    if (googleIdentity.refresh_token) {
      api.idToken.setCustomClaim(`${namespace}/google_refresh_token`, googleIdentity.refresh_token);
    }
    // Auth0 doesn't always have expires_in; default to 3600 (1 hour)
    api.idToken.setCustomClaim(`${namespace}/google_expires_in`, googleIdentity.expires_in || 3600);
  }
};
```

3. Go to **Settings → Secrets** and add the **same** `domain`, `clientId`, `clientSecret` as in Step 4 (you can reuse the same M2M app)
4. **Deploy** the action
5. Go to **Actions → Flows → Login** and drag `Pass Google Tokens to App` **after** the `Auto Link Accounts by Email` action

> **Why use the Management API?** The `event.user.identities` array in Auth0 Actions does NOT include `access_token` or `refresh_token` for security reasons. You must call the Management API to read those from the linked identity. Make sure your M2M app has the `read:users` scope on the Management API.

### Step 6: Store Google Tokens in Waypoint

Waypoint's `syncUser()` function in `lib/user-sync.ts` already runs on every authenticated page load. The Google tokens from the ID token claims are extracted and stored in the `users` table (`google_access_token`, `google_refresh_token`, `google_token_expires_at` columns — added by migration `005_create_schedule_events.sql`).

---

## 4. Verify Application Settings

1. Go to **Auth0 Dashboard → Applications → Applications**
2. Select your Waypoint app
3. Ensure these settings:
   - **Allowed Callback URLs**: `http://localhost:3000/auth/callback`
   - **Allowed Logout URLs**: `http://localhost:3000`
   - **Allowed Web Origins**: `http://localhost:3000`
4. Under **Connections**, verify all four are enabled:
   - ✅ Username-Password-Authentication (default)
   - ✅ github
   - ✅ email (Passwordless)
   - ✅ google-oauth2

---

## 5. PIPEDA Compliance Notes

- **Passwordless email** is the recommended primary sign-in method. No passwords are collected or stored, minimizing personal data under PIPEDA.
- **GitHub OAuth** delegates authentication to GitHub — Waypoint receives only the user's profile and email, not credentials.
- Auth0's session cookies use `AUTH0_SECRET` for encryption; ensure this is a strong 256-bit key in production.
- All auth traffic must use HTTPS in production.

---

## Environment Variables

Add these to your `.env`:

```
AUTH0_DOMAIN=dev-bbp4run0t8tlr2qd.us.auth0.com
AUTH0_CLIENT_ID=Sob557lAYKvQy1BI6RLzZd4IXttuVwT6
AUTH0_CLIENT_SECRET=<your-secret>
AUTH0_SECRET=<64-char-hex>
APP_BASE_URL=http://localhost:3000

# Google Calendar (from Google Cloud Console OAuth credentials)
GOOGLE_CLIENT_ID=<your-google-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```
