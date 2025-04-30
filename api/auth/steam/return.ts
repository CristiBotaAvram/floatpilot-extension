import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import * as openid from 'openid';

export default function handler(req: VercelRequest, res: VercelResponse) {
    const relyingParty = new openid.RelyingParty(
        // This must exactly match your return URL registered in Steam dev console
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
            console.error('Steam OpenID not authenticated or missing identifier:', result);
            return res.status(401).send('Login failed');
        }

        const idMatch = result.claimedIdentifier.match(
            /\/(?:id|openid\/id)\/([0-9]{17})$/
        );
        if (!idMatch) {
            console.error('Steam OpenID invalid claimedIdentifier:', result.claimedIdentifier);
            return res.status(400).send('Invalid Steam response');
        }

        const steamID64 = idMatch[1];
        const token = jwt.sign(
            { steamID64 },
            process.env.JWT_SECRET || 'please_set_a_secret',
            { expiresIn: '7d' }
        );

        // Set a secure, HTTP-only cookie
        res.setHeader('Set-Cookie', [
            `fp_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`,
        ]);

        // Redirect to your frontend
        res.writeHead(302, { Location: '/site' });
        res.end();
    });
}
