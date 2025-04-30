import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
// ← Use a default import, then destructure the constructor you need
import OpenID from 'openid';

export default function handler(req: VercelRequest, res: VercelResponse) {
    // Pull out RelyingParty from the default import
    const { RelyingParty } = OpenID;

    const relyingParty = new RelyingParty(
        `${process.env.BASE_URL}/api/auth/steam/return`,
        null,
        true,
        false,
        []
    );

    relyingParty.verifyAssertion(req, (err, result) => {
        if (err) {
            console.error('Steam OpenID return error:', err);
            return res.status(401).send('Login failed');
        }
        if (!result?.authenticated || !result.claimedIdentifier) {
            console.error('Steam OpenID not authenticated:', result);
            return res.status(401).send('Login failed');
        }

        const match = result.claimedIdentifier.match(
            /\/(?:id|openid\/id)\/([0-9]{17})$/
        );
        if (!match) {
            console.error('Invalid claimedIdentifier:', result.claimedIdentifier);
            return res.status(400).send('Invalid Steam response');
        }
        const steamID64 = match[1];

        const token = jwt.sign(
            { steamID64 },
            process.env.JWT_SECRET || 'dev_secret',
            { expiresIn: '7d' }
        );

        res.setHeader('Set-Cookie', [
            `fp_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`,
        ]);
        res.writeHead(302, { Location: '/' });
        res.end();
    });
}
