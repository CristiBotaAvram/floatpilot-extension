// api/me.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import jwt from 'jsonwebtoken'        // <-- default import
import fetch from 'node-fetch'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getSteamID64 } from './_utils/session.js'

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    // verifySession will throw if the token is invalid or missing
    let steamID64: string | null = null
    try {
        const token = req.cookies.fp_session
        if (!token) throw new Error('no cookie')
        // jwt.verify is a method on the default export
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
            steamID64: string
        }
        steamID64 = payload.steamID64
    } catch (err) {
        console.log('No valid session:', err)
        return res.status(200).json({ loggedIn: false })
    }

    // now that we have a valid steamID64, fetch their Steam profile:
    const key = process.env.STEAM_API_KEY!
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamID64}`

    try {
        const steamRes = await fetch(url)
        const { response } = await steamRes.json()
        const player = response?.players?.[0] || {}
        const displayName = player.personaname || steamID64
        const avatarUrl   = player.avatarmedium || ''

        return res.status(200).json({
            loggedIn:    true,
            steamID64,
            displayName,
            avatarUrl,
            tier: 'Cadet',
        })
    } catch (err) {
        console.error('Error fetching Steam profile:', err)
        return res.status(200).json({
            loggedIn:    true,
            steamID64,
            displayName: steamID64,
            avatarUrl:   '',
            tier:        'Cadet',
        })
    }
}
