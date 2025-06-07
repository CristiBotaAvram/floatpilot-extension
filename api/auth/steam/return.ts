// api/auth/steam/return.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import OpenID from 'openid';
import fetch from 'node-fetch';
import { supabase } from '../../_utils/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { RelyingParty } = OpenID;
    const relyingParty = new RelyingParty(
        `${process.env.BASE_URL}/api/auth/steam/return`,
        null,
        true,
        false,
        []
    );

    relyingParty.verifyAssertion(req, async (err, result) => {
        if (err) {
            console.error('Steam OpenID return error:', err);
            return res.status(401).send('Login failed');
        }
        if (!result?.authenticated || !result.claimedIdentifier) {
            console.error('Steam OpenID not authenticated:', result);
            return res.status(401).send('Login failed');
        }

        const match = result.claimedIdentifier.match(/\/(?:id|openid\/id)\/([0-9]{17})$/);
        if (!match) {
            console.error('Invalid claimedIdentifier:', result.claimedIdentifier);
            return res.status(400).send('Invalid Steam response');
        }
        const steamID64 = match[1];

        try {
            const apiKey = process.env.STEAM_API_KEY;
            if (!apiKey) throw new Error('Missing STEAM_API_KEY');

            const summaryRes = await fetch(
                `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamID64}`
            );
            const summaryJson = await summaryRes.json();

            const player = summaryJson.response.players?.[0];
            const avatarUrl: string | undefined = player?.avatarfull;
            const displayName: string | undefined = player?.personaname;

            const upsertResult = await supabase
                .from('users')
                .upsert({
                    steam_id: steamID64,
                    avatar: avatarUrl,
                    name: displayName,
                    ff_balance: 0
                }, { onConflict: 'steam_id' })
                .select();

            const userData = upsertResult.data?.[0];

            if (upsertResult.error || !userData) {
                console.error('Upsert failed:', upsertResult.error);
                return res.status(500).send('User DB error');
            }

            const tier = userData.tier || 'Cadet';
            const ff_balance = userData.ff_balance || 0;

            const token = jwt.sign(
                { steamID64, avatarUrl, tier, ff_balance },
                process.env.JWT_SECRET!,
                { expiresIn: '7d' }
            );

            res.setHeader('Set-Cookie', [
                `fp_session=${token}; Path=/; HttpOnly; Secure; SameSite=None`
            ]);
            res.writeHead(302, { Location: '/' });
            return res.end();
        } catch (fetchErr) {
            console.error('Error fetching Steam profile or upserting:', fetchErr);
            return res.status(500).send('Login failed');
        }
    });
}
