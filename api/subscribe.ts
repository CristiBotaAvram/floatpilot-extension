// File: api/subscribe.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getSteamID64 } from './_utils/session.js'

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COST: Record<string, number> = {
    'Cadet': 0,
    'Co-Pilot': 150,
    'Commander': 500
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST')
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const steam_id = getSteamID64(req)
    if (!steam_id) {
        return res.status(401).json({ error: 'Not authenticated' })
    }

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

    const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('ff_balance, tier')
        .eq('steam_id', steam_id)
        .single()

    if (fetchError || !user) {
        return res.status(500).json({ error: 'User not found' })
    }

    const currentBalance = user.ff_balance || 0
    const price = COST[tier]

    if (user.tier === tier) {
        return res.status(200).json({ success: true, tier, ff_balance: currentBalance })
    }

    if (currentBalance < price) {
        return res.status(400).json({ error: `Not enough FF. Required: ${price}` })
    }

    const { data, error: updateError } = await supabase
        .from('users')
        .update({
            tier,
            ff_balance: currentBalance - price,
            updated_at: new Date().toISOString()
        })
        .eq('steam_id', steam_id)
        .select()
        .single()

    if (updateError) {
        console.error('Supabase error:', updateError)
        return res.status(500).json({ error: updateError.message })
    }

    return res.status(200).json({ success: true, tier: data.tier, ff_balance: data.ff_balance })
}
