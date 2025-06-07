// api/_utils/session.ts
import type { VercelRequest } from '@vercel/node';
import jwt from 'jsonwebtoken';

interface SessionPayload {
    steamID64: string;
    avatarUrl?: string;
}

export function getSteamID64(req: VercelRequest): string | null {
    const rawCookies = req.headers.cookie || '';
    const match = rawCookies.match(/fp_session=([^;]+)/);
    if (!match) return null;

    try {
        const token = match[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as SessionPayload;
        return payload.steamID64;
    } catch (err) {
        console.error('Invalid session token', err);
        return null;
    }
}

export function getSessionPayload(req: VercelRequest): SessionPayload | null {
    const rawCookies = req.headers.cookie || '';
    const match = rawCookies.match(/fp_session=([^;]+)/);
    if (!match) return null;

    try {
        const token = match[1];
        return jwt.verify(token, process.env.JWT_SECRET!) as SessionPayload;
    } catch (err) {
        console.error('Invalid session token', err);
        return null;
    }
}
