import type { VercelRequest } from '@vercel/node';
import * as jwt from 'jsonwebtoken';

/** Extract SteamID64 from the fp_session cookie, or null if absent/invalid */
export function getSteamID64(req: VercelRequest): string | null {
    const raw = (req.headers.cookie ?? '').match(/fp_session=([^;]+)/);
    if (!raw) return null;

    try {
        const { steamID64 } = jwt.verify(raw[1], process.env.JWT_SECRET!) as {
            steamID64: string;
        };
        return steamID64;
    } catch {
        return null;
    }
}
