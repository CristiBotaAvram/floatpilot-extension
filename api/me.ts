// api/me.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { getSteamID64 } from './_utils/session.js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const steamID64 = getSteamID64(req);
    if (!steamID64) {
        return res.status(200).json({ loggedIn: false });
    }
    console.log(req.headers.cookie)
    const now = new Date();

    // Get most recent active subscription
    const { data: sub, error: subError } = await supabase
        .from('subscriptions')
        .select('tier, expires_at')
        .eq('steam_id', steamID64)
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    let tier: 'Free' | 'Pro' = 'Free';
    let subscriptionExpiresAt: string | null = null;
    if (sub && sub.expires_at && new Date(sub.expires_at) > now) {
        tier = 'Pro';
        subscriptionExpiresAt = sub.expires_at;
    }

    const { data: row, error: selectError } = await supabase
        .from('users')
        .select('display_name, avatar_url, last_fetched_at')
        .eq('steam_id', steamID64)
        .maybeSingle();

    if (selectError) {
        console.error('Supabase select error:', selectError);
        return res.status(500).json({ error: 'Database error' });
    }

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

                await supabase.from('users').upsert({
                    steam_id: steamID64,
                    display_name: displayName,
                    avatar_url: avatarUrl,
                    last_fetched_at: new Date().toISOString()
                }, { onConflict: 'steam_id' });
            }
        } catch (err) {
            console.error('Steam API error:', err);
        }
    }

    // Get FF from ledger
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

    const ff_balance = await getCurrentFF();

    return res.status(200).json({
        loggedIn: true,
        steamID64,
        displayName,
        avatarUrl,
        tier,
        ff_balance,
        subscriptionExpiresAt
    });
}
