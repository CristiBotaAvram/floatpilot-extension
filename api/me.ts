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

    if (req.method === 'PUT') {
        const { tier } = (req.body ?? {}) as { tier?: string };

        if (!tier || !TIERS.includes(tier as Tier)) {
            return res.status(400).json({ error: 'Invalid tier' });
        }

        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('ff_balance, tier')
            .eq('steam_id', steamID64)
            .single();

        if (fetchError || !user) {
            console.error('Supabase fetch error:', fetchError);
            return res.status(500).json({ error: 'User fetch error' });
        }

        const currentTier = user.tier || 'Cadet';
        const currentBalance = user.ff_balance || 0;

        if (currentTier === tier) {
            return res.status(200).json({ success: true, tier });
        }

        const newTier = tier as Tier;
        const cost = FF_COST[newTier];

        if (currentBalance < cost) {
            return res.status(400).json({ error: `Not enough FF. Required: ${cost}` });
        }

        const { error: upsertError } = await supabase
            .from('users')
            .update({
                tier: newTier,
                ff_balance: currentBalance - cost,
                updated_at: new Date().toISOString()
            })
            .eq('steam_id', steamID64);

        if (upsertError) {
            console.error('Supabase upsert error:', upsertError);
            return res.status(500).json({ error: 'Database error' });
        }

        return res.status(200).json({ success: true, tier: newTier, new_balance: currentBalance - cost });
    }

    const { data: row, error: selectError } = await supabase
        .from('users')
        .select('tier, ff_balance, display_name, avatar_url, last_fetched_at')
        .eq('steam_id', steamID64)
        .maybeSingle();

    if (selectError) {
        console.error('Supabase select error:', selectError);
        return res.status(500).json({ error: 'Database error' });
    }

    const tier: Tier = (row?.tier as Tier) || 'Cadet';
    const ff_balance = row?.ff_balance ?? 0;
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

    return res.status(200).json({
        loggedIn: true,
        steamID64,
        displayName,
        avatarUrl,
        tier,
        ff_balance
    });
}
