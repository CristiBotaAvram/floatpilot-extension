// api/auth/steam/return.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import OpenID from 'openid';
import fetch from 'node-fetch'; // or use the built-in global fetch in Node 18+

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { RelyingParty } = OpenID;
    const relyingParty = new RelyingParty(
        `${process.env.BASE_URL}/api/auth/steam/return`, // your callback
        null,
        true,
        false,
        []
    );

    // verifyAssertion can be promisified manually:
    relyingParty.verifyAssertion(req, async (err, result) => {
        if (err) {
            console.error('Steam OpenID return error:', err);
            return res.status(401).send('Login failed');
        }
        if (!result?.authenticated || !result.claimedIdentifier) {
            console.error('Steam OpenID not authenticated:', result);
            return res.status(401).send('Login failed');
        }

        // Extract the SteamID64
        const match = result.claimedIdentifier.match(/\/(?:id|openid\/id)\/([0-9]{17})$/);
        if (!match) {
            console.error('Invalid claimedIdentifier:', result.claimedIdentifier);
            return res.status(400).send('Invalid Steam response');
        }
        const steamID64 = match[1];

        // 1) Fetch the player’s avatar from Steam Web API
        try {
            const apiKey = process.env.STEAM_API_KEY;
            if (!apiKey) throw new Error('Missing STEAM_API_KEY');

            const summaryRes = await fetch(
                `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/` +
                `?key=${apiKey}&steamids=${steamID64}`
            );
            const summaryJson = await summaryRes.json();

            const player = summaryJson.response.players?.[0];
            const avatarUrl: string | undefined = player?.avatarfull;

            // 2) Sign a JWT with both steamID64 and avatarUrl
            const token = jwt.sign(
                { steamID64, avatarUrl },
                process.env.JWT_SECRET!,
                { expiresIn: '7d' }
            );

            // 3) Set the cookie and redirect home
            res.setHeader('Set-Cookie', [
                `fp_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`
            ]);
            res.writeHead(302, { Location: '/' });
            return res.end();
        } catch (fetchErr) {
            console.error('Error fetching Steam profile:', fetchErr);
            return res.status(500).send('Login failed');
        }
    });
}
