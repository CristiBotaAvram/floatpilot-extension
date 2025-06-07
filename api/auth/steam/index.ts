// /api/auth/steam/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RelyingParty } from 'openid';
import { supabase } from '../../_utils/db.js';

let relyingParty: RelyingParty | null = null;

(async () => {
    const openid = (await import('openid')).default;
    relyingParty = new openid.RelyingParty(
        `${process.env.BASE_URL}/api/auth/steam/return`,
        null,
        true,
        false,
        []
    );
})();

export default function handler(_: VercelRequest, res: VercelResponse) {
    if (!relyingParty) {
        console.error('RelyingParty not initialized yet');
        return res.status(500).send('Login unavailable');
    }

    relyingParty.authenticate(
        'https://steamcommunity.com/openid',
        false,
        async (error: unknown, authUrl?: string) => {
            if (error || !authUrl) {
                console.error('Steam OpenID auth error:', error);
                return res.status(500).send('Steam login unavailable');
            }

            // Extract Steam ID
            const match = authUrl.match(/openid\.steam\.com\/openid\/id\/(\d+)/);
            const steamId = match?.[1];

            if (steamId) {
                // Ensure user exists and has FF balance
                await supabase.from('users').upsert({
                    steam_id: steamId,
                    ff_balance: 0
                }, {
                    onConflict: 'steam_id'
                });
            }

            res.writeHead(302, { Location: authUrl });
            res.end();
        }
    );
}
