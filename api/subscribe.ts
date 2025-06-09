// File: api/subscribe.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getSteamID64 } from './_utils/session.js'

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DURATIONS: Record<string, number> = {
    '1 hour': 60 * 60 * 1000,
    '1 day': 24 * 60 * 60 * 1000,
    '1 week': 7 * 24 * 60 * 60 * 1000,
    '1 month': 30 * 24 * 60 * 60 * 1000 // use 30 days for 'month'
}
const VALID_TIERS = ['Co-Pilot', 'Commander']

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST')
        return res.status(405).json({ error: 'Method Not Allowed' })
    }

    const steam_id = getSteamID64(req)
    if (!steam_id) {
        return res.status(401).json({ error: 'Not authenticated' })
    }

    let tier: string, duration: string, cost: number
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
        tier = body.tier
        duration = body.duration
        cost = body.cost
    } catch {
        return res.status(400).json({ error: 'Invalid JSON body' })
    }

    if (!VALID_TIERS.includes(tier)) {
        return res.status(400).json({ error: `Tier must be one of ${VALID_TIERS.join(', ')}` })
    }
    if (!(duration in DURATIONS)) {
        return res.status(400).json({ error: `Duration must be one of: ${Object.keys(DURATIONS).join(', ')}` })
    }
    if (typeof cost !== 'number' || cost <= 0) {
        return res.status(400).json({ error: 'Invalid cost' })
    }

    // Fetch user
    const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('ff_balance')
        .eq('steam_id', steam_id)
        .single()
    if (fetchError || !user) {
        return res.status(500).json({ error: 'User not found' })
    }
    if (user.ff_balance < cost) {
        return res.status(400).json({ error: `Not enough FF. Required: ${cost}` })
    }

    // Find last active (or expired) subscription for this user and tier
    const { data: prevSubs, error: subError } = await supabase
        .from('subscriptions')
        .select('expires_at')
        .eq('steam_id', steam_id)
        .eq('tier', tier)
        .order('expires_at', { ascending: false })
        .limit(1)
    if (subError) {
        return res.status(500).json({ error: 'Failed to check subscriptions' })
    }

    // Calculate new start & end times
    const now = new Date()
    let start = now
    if (prevSubs && prevSubs.length > 0 && prevSubs[0].expires_at) {
        const lastExp = new Date(prevSubs[0].expires_at)
        if (lastExp > now) start = lastExp // stack to end of previous
    }
    const expires = new Date(start.getTime() + DURATIONS[duration])

    // Insert new subscription
    const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
            steam_id,
            tier,
            started_at: start.toISOString(),
            expires_at: expires.toISOString()
        })
    if (insertError) {
        return res.status(500).json({ error: 'Failed to save subscription' })
    }

    // Deduct FF, update user balance
    const newBalance = user.ff_balance - cost
    const { error: updateError } = await supabase
        .from('users')
        .update({ ff_balance: newBalance, updated_at: new Date().toISOString() })
        .eq('steam_id', steam_id)
    if (updateError) {
        return res.status(500).json({ error: 'Failed to update balance' })
    }

    // Log in ff_ledger and transactions
    await supabase.from('ff_ledger').insert({
        steam_id,
        amount: -cost,
        type: `${tier.toLowerCase()}_subscription`,
        reference: `subscription_${duration}`,
        created_at: now.toISOString()
    })
    await supabase.from('transactions').insert({
        steam_id,
        type: `${tier.toLowerCase()}_subscription`,
        ff_before: user.ff_balance,
        ff_after: newBalance,
        amount: -cost,
        created_at: now.toISOString()
    })

    return res.status(200).json({
        success: true,
        tier,
        new_balance: newBalance,
        started_at: start.toISOString(),
        expires_at: expires.toISOString()
    })
}
