// api/me.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
// NOTE: no “.js” here—Vercel will treat .ts files as modules automatically
import { getSteamID64 } from './_utils/session';

export default function handler(req: VercelRequest, res: VercelResponse) {
    const steamID64 = getSteamID64(req);

    if (!steamID64) {
        return res.status(200).json({ loggedIn: false });
    }

    // TODO: fetch subscription tier from DB
    return res.status(200).json({
        loggedIn: true,
        steamID64,
        tier: 'Cadet',
    });
}
