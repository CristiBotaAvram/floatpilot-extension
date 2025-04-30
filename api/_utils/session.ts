import type { VercelRequest } from '@vercel/node';
import jwt from 'jsonwebtoken';

interface JWTPayload {
    steamID64: string;
    iat?: number;
    exp?: number;
}

export function getSteamID64(req: VercelRequest): string | null {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
        return null;
    }

    const match = cookieHeader.match(/(?:^|;\s*)fp_session=([^;]+)/);
    if (!match) {
        return null;
    }

    const token = match[1];

    try {
        // jwt.verify poate întoarce string | object
        const verified = jwt.verify(token, process.env.JWT_SECRET!) as
            | string
            | JWTPayload;

        // Dacă payload-ul e un obiect și are steamID64 de tip string
        if (
            typeof verified === 'object' &&
            verified !== null &&
            typeof verified.steamID64 === 'string'
        ) {
            return verified.steamID64;
        }
        return null;
    } catch (err) {
        console.error('JWT verification failed:', err);
        return null;
    }
}
