// File: api/subscribe.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getSteamID64 } from './_utils/session.js'  // we trust session for steam_id

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow POST
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST')
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    // Ensure user is logged in
    const steam_id = getSteamID64(req)
    if (!steam_id) {
        return res.status(401).json({ error: 'Not authenticated' })
    }

    // Parse and validate the requested tier
    let tier: string
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
        tier = body.tier
    } catch {
        return res.status(400).json({ error: 'Invalid JSON body' })
    }

    const validTiers = ['Cadet', 'Co-Pilot', 'Commander']
    if (!validTiers.includes(tier)) {
        return res.status(400).json({ error: `Tier must be one of ${validTiers.join(', ')}` })
    }

    // Upsert into Supabase: insert new row or update existing
    const { data, error } = await supabase
        .from('users')
        .upsert(
            { steam_id, tier },        // the record to insert or update
            { onConflict: 'steam_id' } // use steam_id column as unique key
        )
        .select()                    // return the row
        .single()                    // expect exactly one row

    if (error) {
        console.error('Supabase error:', error)
        return res.status(500).json({ error: error.message })
    }

    // data is guaranteed non-null by `.single()`
    return res.status(200).json({ success: true, tier: data.tier })
}
