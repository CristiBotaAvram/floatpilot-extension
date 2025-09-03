// api/claim-trial.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    try {
        const steamId = req.headers['x-steamid'] as string
        if (!steamId) return res.status(401).json({ error: 'Unauthorized' })

        // Check if already claimed
        const { data: user, error } = await supabase
            .from('users')
            .select('trialClaimed')
            .eq('steam_id', steamId)
            .single()

        if (error) throw error
        if (user?.trialClaimed) {
            return res.status(400).json({ success: false, error: 'Trial already claimed' })
        }

        // Mark as claimed + set expiry
        const now = new Date()

        const { error: updateErr } = await supabase
            .from('users')
            .update({
                trialClaimed: true
            })
            .eq('steam_id', steamId)

        if (updateErr) throw updateErr

        const { data: prevSubs } = await supabase
            .from('subscriptions')
            .select('expires_at')
            .eq('steam_id', steamId)
            .eq('tier', 'Pro')
            .order('expires_at', { ascending: false })
            .limit(1);

        let start = now;
        if (prevSubs?.[0]?.expires_at && new Date(prevSubs[0].expires_at) > now) {
            start = new Date(prevSubs[0].expires_at);
        }

        const expires = new Date(start.getTime() + 60 * 60 * 1000);

        // Insert subscription
        const { error: insertError } = await supabase
            .from('subscriptions')
            .insert({
                steamId,
                tier: 'Pro',
                started_at: start.toISOString(),
                expires_at: expires.toISOString()
            });

        if (insertError) {
            return res.status(500).json({ error: 'Failed to insert subscription' });
        }

        const nowIso = now.toISOString();


        // Insert transaction
        const { error: txError } = await supabase.from('transactions').insert([
            {
                steamId,
                type: '1hour_free_trial',
                ff_before: 0,
                ff_after: 0,
                created_at: nowIso
            }
        ]);

        if (txError) {
            return res.status(500).json({ error: 'Failed to log ledger or transaction' });
        }

        return res.status(200).json({ success: true, expiresAt: expires.toISOString() })
    } catch (e) {
        return res.status(500).json({ success: false, error: (e as Error).message })
    }
}
