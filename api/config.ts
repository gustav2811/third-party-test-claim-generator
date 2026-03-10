import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Returns public SSO config at runtime. Use SSO_GOOGLE_CLIENT_ID and SSO_ALLOWED_DOMAIN (not VITE_* –
 * Vercel may not expose VITE_* to serverless functions). */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json({
    googleClientId: process.env.SSO_GOOGLE_CLIENT_ID ?? process.env.VITE_GOOGLE_CLIENT_ID ?? '',
    allowedDomain: process.env.SSO_ALLOWED_DOMAIN ?? process.env.VITE_ALLOWED_DOMAIN ?? '',
  });
}
