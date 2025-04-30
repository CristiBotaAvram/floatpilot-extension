import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSteamID64 } from './_utils/session';  // no “.js” extension here

export default function handler(req: VercelRequest, res: VercelResponse) {
    const steamID64 = getSteamID64(req);

    if (!steamID64) {
        // Not logged in
        return res.status(200).json({ loggedIn: false });
    }

    // Logged in; you could fetch subscription info here
    return res.status(200).json({
        loggedIn: true,
        steamID64,
        tier: 'Cadet',  // placeholder
    });
}
