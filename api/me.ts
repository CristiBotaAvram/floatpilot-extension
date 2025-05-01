// api/me.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verify } from 'jsonwebtoken';

// Helper to read cookie
function getToken(req: VercelRequest): string | null {
    const cookie = req.headers.cookie;
    if (!cookie) return null;

    // Find fp_session=… in cookie header
    const match = cookie.match(/(?:^|;\s*)fp_session=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const token = getToken(req);
    if (!token) {
        return res.json({ loggedIn: false });
    }

    let steamID64: string;
    try {
        const payload = verify(token, process.env.JWT_SECRET!) as {
            steamID64: string;
        };
        steamID64 = payload.steamID64;
    } catch (err) {
        console.error('Invalid session token:', err);
        return res.json({ loggedIn: false });
    }

    // Fetch Steam profile
    const apiKey = process.env.STEAM_API_KEY!;
    const url =
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/` +
        `?key=${apiKey}&steamids=${steamID64}`;

    try {
        const steamRes = await fetch(url);
        const data = await steamRes.json();

        const player = data.response?.players?.[0] || {};
        const displayName: string = player.personaname || steamID64;
        const avatarUrl: string = player.avatarfull || '';

        return res.status(200).json({
            loggedIn: true,
            steamID64,
            displayName,
            avatarUrl,
            tier: 'Cadet', // retrieve from your DB when ready
        });
    } catch (err) {
        console.error('Error fetching Steam profile:', err);
        return res.status(200).json({
            loggedIn: true,
            steamID64,
            displayName: steamID64,
            avatarUrl: '',
            tier: 'Cadet',
        });
    }
}
