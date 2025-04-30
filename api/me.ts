import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSteamID64 } from './_utils/session';

export default function handler(req: VercelRequest, res: VercelResponse) {
    const steamID64 = getSteamID64(req);

    if (!steamID64) {
        res.status(200).json({ loggedIn: false });
        return;
    }

    // Later: look up subscription tier in DB
    res.json({
        loggedIn: true,
        steamID64,
        tier: 'Cadet',          // placeholder
    });
}
