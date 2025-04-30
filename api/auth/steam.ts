import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RelyingParty } from 'openid';

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
        (error: unknown, authUrl?: string) => {
            if (error || !authUrl) {
                console.error('Steam OpenID auth error:', error);
                res.status(500).send('Steam login unavailable');
                return;
            }
            res.writeHead(302, { Location: authUrl });
            res.end();
        }
    );
}
