// api/subscribe.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { steam_id, tier } = JSON.parse(req.body)
    // ... validate steam_id, tier, etc.

    // 1) Upsert the subscription record
    const { data, error } = await supabase
        .from('users')
        .insert({ steam_id, tier })
        .select()
        .single()

    if (error) {
        console.error('Supabase error:', error)
        return res.status(500).json({ error: error.message })
    }

    if (!data) {
        // data really shouldn't be null if `.single()` succeeded, but TS wants us to check
        return res.status(500).json({ error: 'No data returned from database' })
    }

    // Now TS knows data is not null:
    const savedTier = data.tier

    return res.status(200).json({ success: true, tier: savedTier })
}
