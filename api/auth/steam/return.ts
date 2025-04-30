import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-expect-error – temporary until openid-client types fixed
import { Issuer } from 'openid-client';
import * as jwt from 'jsonwebtoken';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const steam = await Issuer.discover('https://steamcommunity.com/openid');

    // Same redirect URI used above
    const redirectUri = `${process.env.BASE_URL}/api/auth/steam/return`;
    const client = new steam.Client({ client_id: 'steam', redirect_uris: [redirectUri], response_types: ['id_token'] });

    // Verify Steam’s assertion
    const params    = client.callbackParams(req);
    const tokenSet  = await client.callback(redirectUri, params);
    const steamID64 = tokenSet.claims().sub.replace('https://steamcommunity.com/openid/id/', '');

    // Create a 7-day signed cookie (replace with your own session-store if you like)
    const cookie = jwt.sign({ steamID64 }, process.env.JWT_SECRET!, { expiresIn: '7d' });
    res.setHeader('Set-Cookie', `fp_session=${cookie}; Path=/; HttpOnly; Secure; SameSite=Lax`);

    // Redirect back to your site (pricing/dashboard)
    res.writeHead(302, { Location: '/site' });
    res.end();
}
