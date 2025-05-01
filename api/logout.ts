// api/logout.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    // Overwrite the cookie with an expired one
    res.setHeader('Set-Cookie', [
        `fp_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    ]);

    // Redirect back to homepage (or wherever)
    res.writeHead(302, { Location: '/' });
    res.end();
}
