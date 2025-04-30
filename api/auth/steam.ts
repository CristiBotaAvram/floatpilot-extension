import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as openid from 'openid';

const relyingParty = new openid.RelyingParty(
    `${process.env.BASE_URL}/api/auth/steam/return`, // return URL
    null, // realm (optional)
    true, // use stateless verification
    false, // strict mode
    [] // extensions
);

export default function handler(_: VercelRequest, res: VercelResponse) {
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
