// api/me.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSteamID64 } from './_utils/session.js';
import fetch from 'node-fetch';  // install if you don’t have it yet

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const steamID64 = getSteamID64(req);
    if (!steamID64) {
        return res.status(200).json({ loggedIn: false });
    }

    // Call Steam Web API to get the persona name
    const key = process.env.STEAM_API_KEY!;
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamID64}`;

    try {
        const steamRes = await fetch(url);
        const { response } = await steamRes.json();
        const player = response?.players?.[0];
        const displayName = player?.personaname || steamID64;

        return res.status(200).json({
            loggedIn: true,
            steamID64,
            displayName,
            tier: 'Cadet', // or fetch from your DB
        });
    } catch (err) {
        console.error('Error fetching Steam persona:', err);
        // Fallback: still return the SteamID if name fetch fails
        return res.status(200).json({
            loggedIn: true,
            steamID64,
            displayName: steamID64,
            tier: 'Cadet',
        });
    }
}
