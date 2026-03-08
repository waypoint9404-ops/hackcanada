# Auth0 Configuration — GitHub + Passwordless Email

This guide covers the Auth0 Dashboard configuration required for the Waypoint login page to work with **GitHub social login** and **Passwordless email (OTP)** sign-in.

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

## 3. Verify Application Settings

1. Go to **Auth0 Dashboard → Applications → Applications**
2. Select your Waypoint app
3. Ensure these settings:
   - **Allowed Callback URLs**: `http://localhost:3000/auth/callback`
   - **Allowed Logout URLs**: `http://localhost:3000`
   - **Allowed Web Origins**: `http://localhost:3000`
4. Under **Connections**, verify all three are enabled:
   - ✅ Username-Password-Authentication (default)
   - ✅ github
   - ✅ email (Passwordless)

---

## 4. PIPEDA Compliance Notes

- **Passwordless email** is the recommended primary sign-in method. No passwords are collected or stored, minimizing personal data under PIPEDA.
- **GitHub OAuth** delegates authentication to GitHub — Waypoint receives only the user's profile and email, not credentials.
- Auth0's session cookies use `AUTH0_SECRET` for encryption; ensure this is a strong 256-bit key in production.
- All auth traffic must use HTTPS in production.

---

## Environment Variables

No new environment variables are needed. The existing `.env` configuration works:

```
AUTH0_DOMAIN=dev-bbp4run0t8tlr2qd.us.auth0.com
AUTH0_CLIENT_ID=Sob557lAYKvQy1BI6RLzZd4IXttuVwT6
AUTH0_CLIENT_SECRET=<your-secret>
AUTH0_SECRET=<64-char-hex>
APP_BASE_URL=http://localhost:3000
```
