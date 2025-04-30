import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_: VercelRequest, res: VercelResponse) {
    // Skip broken TS types: dynamic import as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const openid = await import('openid-client') as any;

    const steam = await openid.Issuer.discover('https://steamcommunity.com/openid');

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
