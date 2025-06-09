// api/me.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { getSteamID64 } from './_utils/session.js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TIERS = ['Cadet', 'Co-Pilot', 'Commander'] as const;
type Tier = (typeof TIERS)[number];

const FF_COST: Record<Tier, number> = {
    'Cadet': 0,
    'Co-Pilot': 150,
    'Commander': 500
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const steamID64 = getSteamID64(req);
    if (!steamID64) {
        return res.status(200).json({ loggedIn: false });
    }

    // Helper: Calculate FF from ledger
    async function getCurrentFF(): Promise<number> {
        const { data, error } = await supabase
            .from('ff_ledger')
            .select('amount')
            .eq('steam_id', steamID64);

        if (error) {
            console.error('Ledger fetch error:', error);
            return 0;
        }

        return data?.reduce((sum, row) => sum + row.amount, 0) || 0;
    }

    if (req.method === 'PUT') {
        const { tier } = (req.body ?? {}) as { tier?: string };

        if (!tier || !TIERS.includes(tier as Tier)) {
            return res.status(400).json({ error: 'Invalid tier' });
        }

        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('tier')
            .eq('steam_id', steamID64)
            .single();

        if (fetchError || !user) {
            console.error('Supabase fetch error:', fetchError);
            return res.status(500).json({ error: 'User fetch error' });
        }

        const currentTier = user.tier || 'Cadet';
        if (currentTier === tier) {
            return res.status(200).json({ success: true, tier });
        }

        const newTier = tier as Tier;
        const cost = FF_COST[newTier];
        const currentBalance = await getCurrentFF();

        if (currentBalance < cost) {
            return res.status(400).json({ error: `Not enough FF. Required: ${cost}` });
        }

        const { error: tierUpdateErr } = await supabase
            .from('users')
            .update({ tier: newTier, updated_at: new Date().toISOString() })
            .eq('steam_id', steamID64);

        if (tierUpdateErr) {
            console.error('Tier update error:', tierUpdateErr);
            return res.status(500).json({ error: 'Failed to update tier' });
        }

        const { error: ledgerError } = await supabase.from('ff_ledger').insert([
            {
                steam_id: steamID64,
                amount: -cost,
                type: 'subscription',
                reference: `tier:${newTier}`
            },
            {
                steam_id: 'platform',
                amount: cost,
                type: 'subscription',
                reference: `tier:${newTier}`
            }
        ]);

        if (ledgerError) {
            console.error('Ledger insert error:', ledgerError);
            return res.status(500).json({ error: 'Failed to insert ledger entries' });
        }
        const { error: txError } = await supabase.from('transactions').insert({
            steam_id: steamID64,
            type: `${newTier.toLowerCase().replace(/ /g, '-')}_subscription`,
            ff_before: currentBalance,
            ff_after: currentBalance - cost
        });

        if (txError) {
            console.error('Transaction log error:', txError);
        }


        return res.status(200).json({ success: true, tier: newTier });
    }

    const { data: row, error: selectError } = await supabase
        .from('users')
        .select('tier, display_name, avatar_url, last_fetched_at')
        .eq('steam_id', steamID64)
        .maybeSingle();

    if (selectError) {
        console.error('Supabase select error:', selectError);
        return res.status(500).json({ error: 'Database error' });
    }

    const tier: Tier = (row?.tier as Tier) || 'Cadet';
    let displayName = row?.display_name ?? steamID64;
    let avatarUrl = row?.avatar_url ?? '';
    const lastFetchedAt = row?.last_fetched_at ? new Date(row.last_fetched_at) : null;
    const shouldRefresh = !lastFetchedAt || (Date.now() - lastFetchedAt.getTime()) > 30 * 24 * 60 * 60 * 1000;

    if (shouldRefresh) {
        try {
            const key = process.env.STEAM_API_KEY!;
            const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/');
            url.searchParams.set('key', key);
            url.searchParams.set('steamids', steamID64);

            const steamRes = await fetch(url.toString());
            const json = await steamRes.json();
            const player = json.response?.players?.[0];

            if (player) {
                displayName = player.personaname;
                avatarUrl = player.avatarfull;

                await supabase.from('users').update({
                    display_name: displayName,
                    avatar_url: avatarUrl,
                    last_fetched_at: new Date().toISOString()
                }).eq('steam_id', steamID64);
            }
        } catch (err) {
            console.error('Steam API error:', err);
        }
    }

    const ff_balance = await getCurrentFF();

    return res.status(200).json({
        loggedIn: true,
        steamID64,
        displayName,
        avatarUrl,
        tier,
        ff_balance
    });
}
