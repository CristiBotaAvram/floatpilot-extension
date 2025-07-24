// api/auth/steam/return.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import OpenID from 'openid';
import fetch from 'node-fetch';
import { supabase } from '../../_utils/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { RelyingParty } = OpenID;
    const host = req.headers.host;
    const dynamicBaseUrl = `https://${host}`;

    const relyingParty = new RelyingParty(
        `${dynamicBaseUrl}/api/auth/steam/return`,
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
            const { data: existingUser, error: selectError } = await supabase
                .from('users')
                .select('steam_id, avatar_url, display_name, api_key')
                .eq('steam_id', steamID64)
                .maybeSingle();

            let userData = existingUser;

            if (!existingUser) {
                const apiKey = process.env.STEAM_API_KEY;
                if (!apiKey) throw new Error('Missing STEAM_API_KEY');

                const summaryRes = await fetch(
                    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamID64}`
                );

                const raw = await summaryRes.text();
                let summaryJson;
                try {
                    summaryJson = JSON.parse(raw);
                } catch (jsonErr) {
                    console.error('Invalid Steam JSON:', raw);
                    throw jsonErr;
                }

                const player = summaryJson.response.players?.[0];
                const avatarUrl: string = player?.avatarfull ?? '';
                const displayName: string = player?.personaname ?? '';

                const insertResult = await supabase
                    .from('users')
                    .insert({ steam_id: steamID64, avatar_url: avatarUrl, display_name: displayName })
                    .select('steam_id, avatar_url, display_name, api_key')
                    .single();

                if (insertResult.error || !insertResult.data) {
                    console.error('Insert failed:', insertResult.error);
                    return res.status(500).send('User insert error');
                }

                userData = insertResult.data;
            }

            const token = jwt.sign(
                {
                    steamID64,
                    avatarUrl: userData?.avatar_url ?? '',
                    displayName: userData?.display_name ?? '',
                    apiKey: userData?.api_key ?? ''
                },
                process.env.JWT_SECRET!,
                { expiresIn: '7d' }
            );

            res.setHeader('Set-Cookie', [
                `fp_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`
            ]);

            res.writeHead(302, { Location: '/' });
            return res.end();
        } catch (fetchErr) {
            console.error('Error fetching Steam profile or upserting:', fetchErr);
            return res.status(500).send('Login failed');
        }
    });
}
