import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_: VercelRequest, res: VercelResponse) {
    const openid = (await import('openid-client')) as Record<string, any>;
    const Issuer = openid?.Issuer;

    if (!Issuer) {
        console.error('❌ Issuer not found on openid-client');
        return res.status(500).send('Steam login unavailable');
    }

    const steam = await Issuer.discover('https://steamcommunity.com/openid');

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
