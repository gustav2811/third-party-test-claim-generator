<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Third-Party Test Claim Generator

A tool for generating realistic third-party motor vehicle accident scenarios and supporting documents for insurance claims testing.

## Run Locally

**Prerequisites:** Node.js, [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set `GEMINI_API_KEY` in [.env.local](.env.local):
   ```
   GEMINI_API_KEY="your-gemini-api-key"
   ```

3. Start the development server (runs both the frontend and the API proxy functions):
   ```bash
   npx vercel dev
   ```
   The first time you run this, the Vercel CLI will prompt you to link the project to your Vercel account.

   The app will be available at `http://localhost:3000`.

> **Why `vercel dev` instead of `npm run dev`?**
> The app calls backend API routes (`/api/chat`, `/api/generate-image`) that run as Vercel serverless functions. `vercel dev` runs both the Vite frontend and those functions together. Using `npm run dev` alone will cause API calls to fail.

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import the project at [vercel.com](https://vercel.com/new).
3. Add a `GEMINI_API_KEY` environment variable in **Project Settings → Environment Variables**.
4. Deploy — Vercel auto-detects Vite and configures the build.
