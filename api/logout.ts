// api/logout.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_: VercelRequest, res: VercelResponse) {
    // Overwrite fp_session with empty + expired
    res.setHeader('Set-Cookie', [
        `fp_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    ])

    // Redirect back to the homepage (or wherever)
    res.writeHead(302, { Location: '/' })
    return res.end()
}
