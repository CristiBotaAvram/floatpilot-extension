import type { VercelRequest, VercelResponse } from '@vercel/node';
// @ts-expect-error – temporary until openid-client types fixed
import { Issuer } from 'openid-client';


export default async function handler(_: VercelRequest, res: VercelResponse) {
    // Discover Steam’s OpenID issuer
    const steam = await Issuer.discover('https://steamcommunity.com/openid');

    // Build auth URL (Steam ignores client_id, but openid-client requires one)
    const url = steam.authorizationUrl({
        client_id: 'steam',
        redirect_uri: `${process.env.BASE_URL}/api/auth/steam/return`,
        response_type: 'id_token',
        scope: 'openid',
        response_mode: 'form_post',
    });

    res.writeHead(302, { Location: url });
    res.end();
}
