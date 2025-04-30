// api/auth/steam/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenID from 'openid';

export default function handler(req: VercelRequest, res: VercelResponse) {
    const { RelyingParty } = OpenID;

    // initialize Steam OpenID relying party
    const rp = new RelyingParty(
        `${process.env.BASE_URL}/api/auth/steam/return`, // your return URL
        null,       // realm (not used by Steam)
        true,       // use stateless verification
        false,      // not using strict mode
        []          // no extensions
    );

    // generate the redirect URL
    const redirectUrl = rp.authenticationUrl(
        'https://steamcommunity.com/openid/login'
    );

    // send user off to Steam
    res.writeHead(302, { Location: redirectUrl });
    res.end();
}
