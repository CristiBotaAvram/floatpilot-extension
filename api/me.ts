// api/me.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { getSteamID64 } from './_utils/session.js';

// ---------------  Supabase  -------------------
const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------------  Types -----------------------
const TIERS = ['Cadet', 'Co-Pilot', 'Commander'] as const;
type Tier = (typeof TIERS)[number];

// ---------------  Handler ---------------------
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const steamID64 = getSteamID64(req);
    if (!steamID64) {
        return res.status(200).json({ loggedIn: false });
    }

    // ---------- PUT  (update tier) --------------
    if (req.method === 'PUT') {
        // Vercel already parsed JSON if content-type was application/json
        const { tier } = (req.body ?? {}) as { tier?: string };

        // Validate tier
        if (!tier || !TIERS.includes(tier as Tier)) {
            return res.status(400).json({ error: 'Invalid tier' });
        }

        // Upsert user record
        const { error: upsertError } = await supabase
            .from('users')
            .upsert(
                {
                    steam_id:   steamID64,
                    tier:       tier as Tier,
                    created_at: new Date().toISOString()
                },
                { onConflict: 'steam_id', ignoreDuplicates: false }
            );

        if (upsertError) {
            console.error('Supabase upsert error:', upsertError);
            return res.status(500).json({ error: 'Database error' });
        }

        return res.status(200).json({ success: true, tier });
    }

    // ---------- GET  (load profile + tier) ------
    const { data: row, error: selectError } = await supabase
        .from('users')
        .select('tier')
        .eq('steam_id', steamID64)
        .maybeSingle();          // returns null instead of 404 error

    if (selectError) {
        console.error('Supabase select error:', selectError);
        return res.status(500).json({ error: 'Database error' });
    }

    const tier: Tier = (row?.tier as Tier) || 'Cadet';

    // ---------- Steam profile -------------------
    let displayName = steamID64;
    let avatarUrl   = '';

    try {
        const key = process.env.STEAM_API_KEY!;
        const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/');
        url.searchParams.set('key', key);
        url.searchParams.set('steamids', steamID64);

        const steamRes = await fetch(url.toString());
        const json     = await steamRes.json();
        const player   = json.response?.players?.[0];

        if (player) {
            displayName = player.personaname;
            avatarUrl   = player.avatarfull;
        }
    } catch (err) {
        console.error('Steam API error:', err);
    }

    return res.status(200).json({
        loggedIn: true,
        steamID64,
        displayName,
        avatarUrl,
        tier
    });
}
