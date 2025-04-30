import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import type { AssertionResponse } from 'openid';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const openid = (await import('openid')).default;

    const relyingParty = new openid.RelyingParty(
        `${process.env.BASE_URL}/api/auth/steam/return`,
        null,
        true,
        false,
        []
    );

    relyingParty.verifyAssertion(req, (error: unknown, result: AssertionResponse | null) => {
        console.log('Steam OpenID result:', JSON.stringify(result, null, 2));
        console.error('Steam OpenID error:', error);
        console.log('Steam OpenID verifyAssertion callback:');
        if (result) {
            console.log('✅ Result:', result);
        }
        if (error) {
            console.error('❌ Error:', error);
        }

        if (error || !result?.authenticated || !result.claimedIdentifier) {
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
