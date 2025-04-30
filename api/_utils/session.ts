// api/_utils/session.ts
import type { VercelRequest } from '@vercel/node';
import jwt from 'jsonwebtoken';

export function getSteamID64(req: VercelRequest): string | null {
    // read cookie header
    const rawCookies = req.headers.cookie || '';
    const match = rawCookies.match(/fp_session=([^;]+)/);
    if (!match) return null;

    try {
        const token = match[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as { steamID64: string };
        return payload.steamID64;
    } catch (err) {
        console.error('Invalid session token', err);
        return null;
    }
}
