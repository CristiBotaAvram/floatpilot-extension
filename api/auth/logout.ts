import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_: VercelRequest, res: VercelResponse) {
    res.setHeader(
        'Set-Cookie',
        'fp_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax'
    );
    res.writeHead(302, { Location: '/site' });
    res.end();
}
