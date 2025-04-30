import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as openid from 'openid';
import jwt from 'jsonwebtoken';

const relyingParty = new openid.RelyingParty(
    `${process.env.BASE_URL}/api/auth/steam/return`,
    null,
    true,
    false,
    []
);

export default function handler(req: VercelRequest, res: VercelResponse) {
    relyingParty.verifyAssertion(req, (error, result) => {
        if (error || !result?.authenticated || !result.claimedIdentifier) {
            console.error('Steam OpenID return error:', error);
            return res.status(401).send('Login failed');
        }

        // Extract the SteamID64 from the claimed identifier URL
        const match = result.claimedIdentifier.match(/\/id\/([0-9]{17})$/) ||
            result.claimedIdentifier.match(/\/openid\/id\/([0-9]{17})$/);

        if (!match) {
            return res.status(400).send('Invalid Steam response');
        }

        const steamID64 = match[1];
        const token = jwt.sign({ steamID64 }, process.env.JWT_SECRET!, { expiresIn: '7d' });

        res.setHeader(
            'Set-Cookie',
            `fp_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`
        );
        res.writeHead(302, { Location: '/site' });
        res.end();
    });
}
