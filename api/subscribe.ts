//api/subscribe.ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getSteamID64 } from './_utils/session.js'

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const bonus = 1;

const DURATIONS: Record<string, number> = {
    '1 hour': 60 * 60 * 1000 * bonus,
    '1 day': 24 * 60 * 60 * 1000 * bonus,
    '1 week': 7 * 24 * 60 * 60 * 1000 * bonus,
    '1 month': 30 * 24 * 60 * 60 * 1000 * bonus
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const steam_id = getSteamID64(req);
    if (!steam_id) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    let tier: string, duration: string, cost: number;
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        if (!body || body.tier !== 'Pro' || !body.duration || typeof body.cost !== 'number') {
            return res.status(400).json({ error: 'Missing or invalid fields in request body' });
        }
        tier = body.tier;
        duration = body.duration;
        cost = body.cost;
    } catch {
        return res.status(400).json({ error: 'Invalid JSON body' });
    }

    if (!(duration in DURATIONS)) {
        return res.status(400).json({ error: `Duration must be one of: ${Object.keys(DURATIONS).join(', ')}` });
    }
    if (typeof cost !== 'number' || cost <= 0) {
        return res.status(400).json({ error: 'Invalid cost' });
    }

    // Get FF balance from ledger
    const { data: ledger, error: ledgerError } = await supabase
        .from('ff_ledger')
        .select('amount')
        .eq('steam_id', steam_id);

    if (ledgerError || !ledger) {
        return res.status(500).json({ error: 'Could not retrieve FF ledger' });
    }

    const currentBalance = ledger.reduce((sum, entry) => sum + entry.amount, 0);
    if (currentBalance < cost) {
        return res.status(400).json({ error: `Not enough FF. Required: ${cost}` });
    }

    // Determine new subscription time window
    const now = new Date();
    const { data: prevSubs } = await supabase
        .from('subscriptions')
        .select('expires_at')
        .eq('steam_id', steam_id)
        .eq('tier', 'Pro')
        .order('expires_at', { ascending: false })
        .limit(1);

    let start = now;
    if (prevSubs?.[0]?.expires_at && new Date(prevSubs[0].expires_at) > now) {
        start = new Date(prevSubs[0].expires_at);
    }

    const expires = new Date(start.getTime() + DURATIONS[duration]);

    // Insert subscription
    const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
            steam_id,
            tier: 'Pro',
            started_at: start.toISOString(),
            expires_at: expires.toISOString()
        });

    if (insertError) {
        return res.status(500).json({ error: 'Failed to insert subscription' });
    }

    const nowIso = now.toISOString();

    // Insert ledger entry
    const { error: ledgerInsertError } = await supabase.from('ff_ledger').insert([
        {
            steam_id,
            amount: -cost,
            type: 'pro_subscription',
            reference: `subscription_${duration}`,
            created_at: nowIso
        }
    ]);

    // Insert transaction
    const { error: txError } = await supabase.from('transactions').insert([
        {
            steam_id,
            type: 'pro_subscription',
            ff_before: currentBalance,
            ff_after: currentBalance - cost,
            created_at: nowIso
        }
    ]);

    if (ledgerInsertError || txError) {
        return res.status(500).json({ error: 'Failed to log ledger or transaction' });
    }

    return res.status(200).json({
        success: true,
        tier: 'Pro',
        new_balance: currentBalance - cost,
        started_at: start.toISOString(),
        expires_at: expires.toISOString()
    });
}
