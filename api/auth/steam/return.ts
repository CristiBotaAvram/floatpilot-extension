import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import type { RelyingParty, AssertionResponse } from 'openid';

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

export default function handler(req: VercelRequest, res: VercelResponse) {
    if (!relyingParty) {
        console.error('RelyingParty not initialized yet');
        return res.status(500).send('Login unavailable');
    }

    relyingParty.verifyAssertion(req, (error: unknown, result: AssertionResponse | null) => {
        if (error || !result?.authenticated || !result.claimedIdentifier) {
            console.error('Steam OpenID return error:', error);
            return res.status(401).send('Login failed');
        }

        const match = result.claimedIdentifier.match(/\/(id|openid\/id)\/([0-9]{17})$/);
        if (!match) {
            return res.status(400).send('Invalid Steam response');
        }

        const steamID64 = match[2];
        const token = jwt.sign({ steamID64 }, process.env.JWT_SECRET!, { expiresIn: '7d' });

        res.setHeader(
            'Set-Cookie',
            `fp_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`
        );
        res.writeHead(302, { Location: '/site' });
        res.end();
    });
}
