// api/logout.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_: VercelRequest, res: VercelResponse) {
    // Invalidate fp_session cookie
    res.setHeader('Set-Cookie', [
        `fp_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    ])

    // Optional: also invalidate in-memory or token-based cache logic here if needed

    res.writeHead(302, { Location: '/' })
    return res.end()
}
