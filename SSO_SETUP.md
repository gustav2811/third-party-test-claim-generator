# SSO setup: restrict access to your company Google domain

This app uses **Google Identity Services** with a **hosted domain**. Google’s OAuth enforces the restriction: only users from your company’s Google Workspace can complete sign-in.

---

## Step 1: Open Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one (e.g. same project you use for Gemini).
3. Note the **project name** — you’ll use it in the consent screen.

---

## Step 2: Configure the OAuth consent screen

1. In the left menu go to **APIs & Services** → **OAuth consent screen**.
2. Choose **Internal** if only your organisation should see the app (recommended for company-only SSO).  
   Otherwise choose **External** if you need to allow test users outside your org.
3. Fill in:
   - **App name**: e.g. `Naked Claims` or `Third Party Claim Generator`
   - **User support email**: your email
   - **Developer contact**: your email
4. Click **Save and Continue**.
5. **Scopes**: Add `.../auth/userinfo.email`, `.../auth/userinfo.profile`, and `openid`.  
   Then **Save and Continue**.
6. If **External**: add **Test users** (your email or colleagues) until the app is published.  
   Then **Save and Continue**.
7. Review and go back to the dashboard.

---

## Step 3: Create OAuth 2.0 credentials

1. Go to **APIs & Services** → **Credentials**.
2. Click **+ Create credentials** → **OAuth client ID**.
3. **Application type**: **Web application**.
4. **Name**: e.g. `Naked Claims Web Client`.
5. **Authorized JavaScript origins**:
   - Local: `http://localhost:3000`
   - Production: your app URL, e.g. `https://third-party-test-claim-generator.vercel.app` (no trailing slash).
6. **Authorized redirect URIs** (needed for the OAuth flow):
   - Local: `http://localhost:3000`
   - Production: `https://third-party-test-claim-generator.vercel.app` (or same as origin; GIS can use the current page).
7. Click **Create**.
8. Copy the **Client ID** (looks like `xxxxx.apps.googleusercontent.com`).  
   You’ll use it as `VITE_GOOGLE_CLIENT_ID` in the app.

---

## Step 4: Get your company Google domain

- Your **hosted domain** is the part after `@` in your work email, e.g. `company.com`.
- It must be a [Google Workspace](https://workspace.google.com/) domain (or the domain you use with Google sign-in for work).
- You’ll use it as `VITE_ALLOWED_DOMAIN` in the app (e.g. `company.com`).

---

## Step 5: Set environment variables in the app

1. In the project root, copy `.env.example` to `.env` (or configure env in Vercel/hosting).
2. Add:

```bash
# Google SSO (domain-restricted)
VITE_GOOGLE_CLIENT_ID="YOUR_CLIENT_ID.apps.googleusercontent.com"
VITE_ALLOWED_DOMAIN="yourcompany.com"
```

- **VITE_GOOGLE_CLIENT_ID**: the OAuth Client ID from Step 3.
- **VITE_ALLOWED_DOMAIN**: the hosted domain from Step 4 (no `@`, no `https://`).

3. For **production** (e.g. Vercel): set the same variables in the project’s **Environment variables** and redeploy.

---

## Step 6: Run the app and sign in

1. Install and run:

   ```bash
   npm install
   npm run dev
   ```

2. Open `http://localhost:3000`.
3. You should see a **Sign in with Google** screen.
4. Sign in with a **@yourcompany.com** account.  
   Sign-in is restricted to that domain; other Google accounts will not be allowed.
5. After sign-in you’ll get the main app (and then the API key gate if you use that).

---

## Optional: Restrict API routes to signed-in users

If you want your API (e.g. `/api/chat`) to allow only signed-in users from your domain:

1. The front end sends the **Google ID token** in a header (e.g. `Authorization: Bearer <id_token>`).
2. In the API route, verify the token with Google’s libraries or a JWT library and check the `hd` claim equals `VITE_ALLOWED_DOMAIN` (or the same value from env).  
   Reject requests with missing or invalid tokens or wrong domain.

If you want, we can add this token verification to your existing API routes next.

---

## Troubleshooting

| Issue                                           | What to check                                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| “Access blocked: This app’s request is invalid” | Correct Client ID; authorised origins/redirect URIs include the exact URL you’re using (port, no trailing slash).     |
| “This app isn’t verified”                       | For External consent, use “Advanced” → “Go to … (unsafe)” for testing, or submit for verification for production.     |
| Only “Loading…” or no button                    | `VITE_GOOGLE_CLIENT_ID` and `VITE_ALLOWED_DOMAIN` set; page loaded over HTTP/HTTPS (not `file://`).                   |
| “Wrong domain” after sign-in                    | `VITE_ALLOWED_DOMAIN` matches your work domain exactly (e.g. `company.com`).                                          |
| Button doesn’t appear                           | Browser console for script/network errors; ensure the GIS script loads from `https://accounts.google.com/gsi/client`. |

---

## Summary checklist

- [ ] OAuth consent screen configured (Internal or External).
- [ ] Web application OAuth client created; Client ID copied.
- [ ] Authorized JavaScript origins and redirect URIs include your app URL(s).
- [ ] `VITE_GOOGLE_CLIENT_ID` and `VITE_ALLOWED_DOMAIN` set in `.env` and production.
- [ ] Sign-in tested with a @yourcompany.com account.
