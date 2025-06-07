// /api/auth/steam/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RelyingParty } from 'openid';
import { supabase } from '../../_utils/db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const openid = (await import('openid')).default;
    const host = req.headers.host;
    const dynamicBaseUrl = `https://${host}`;

    const relyingParty: RelyingParty = new openid.RelyingParty(
        `${dynamicBaseUrl}/api/auth/steam/return`,
        null,
        true,
        false,
        []
    );

    relyingParty.authenticate(
        'https://steamcommunity.com/openid',
        false,
        async (error: unknown, authUrl?: string) => {
            if (error || !authUrl) {
                console.error('Steam OpenID auth error:', error);
                return res.status(500).send('Steam login unavailable');
            }

            res.writeHead(302, { Location: authUrl });
            res.end();
        }
    );
}
