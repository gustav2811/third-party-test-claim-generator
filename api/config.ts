import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Returns public SSO config at runtime (avoids Vite build-time env issues on Vercel). */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({
    googleClientId: process.env.VITE_GOOGLE_CLIENT_ID ?? '',
    allowedDomain: process.env.VITE_ALLOWED_DOMAIN ?? '',
  });
}
