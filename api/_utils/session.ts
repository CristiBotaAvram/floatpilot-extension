import type { VercelRequest } from '@vercel/node';
import * as jwt from 'jsonwebtoken';

export function getSteamID64(req: VercelRequest): string | null {
    const cookie = req.headers.cookie ?? '';
    const match = cookie.match(/fp_session=([^;]+)/);
    if (!match) return null;

    try {
        const { steamID64 } = jwt.verify(match[1], process.env.JWT_SECRET!) as {
            steamID64: string;
        };
        return steamID64;
    } catch {
        return null;
    }
}
