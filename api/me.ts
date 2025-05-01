// api/me.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from './_utils/db.js'
import { getSteamID64 } from './_utils/session.js'
import fetch from 'node-fetch'

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const steamID64 = getSteamID64(req)
    if (!steamID64) {
        return res.status(200).json({ loggedIn: false })
    }

    // 1) If this is a PUT, update their tier
    if (req.method === 'PUT') {
        const { tier } = JSON.parse(req.body || '{}')
        if (!['Cadet','Co-Pilot','Commander'].includes(tier)) {
            return res.status(400).json({ error: 'Invalid tier' })
        }
        db.prepare(`
      INSERT INTO users (steamID64, tier, updatedAt)
      VALUES (@steamID64, @tier, @time)
      ON CONFLICT(steamID64) DO UPDATE SET
        tier = excluded.tier,
        updatedAt = excluded.updatedAt
    `).run({
            steamID64,
            tier,
            time: Date.now(),
        })
        return res.status(200).json({ success: true, tier })
    }

    // 2) On GET: load their saved tier (defaults to Cadet)
    const row = db.prepare(
        'SELECT tier FROM users WHERE steamID64 = ?'
    ).get(steamID64)
    const tier = row?.tier || 'Cadet'

    // 3) Fetch Steam displayName & avatar as before
    const key = process.env.STEAM_API_KEY!
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamID64}`
    let displayName = steamID64, avatarUrl = ''
    try {
        const steamRes = await fetch(url)
        const { response } = await steamRes.json()
        const player = response.players?.[0]
        displayName = player.personaname
        avatarUrl  = player.avatarfull
    } catch (e) {
        console.error('Steam API error fetching persona:', e)
    }

    return res.status(200).json({
        loggedIn:    true,
        steamID64,
        displayName,
        avatarUrl,
        tier,
    })
}
