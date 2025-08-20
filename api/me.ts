// /api/me.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Look up user by API key in Supabase
const TABLE_NAME = 'users';

type DBUser = {
    steam_id: string;
    avatar_url: string | null;
    display_name: string | null;
    tier: string | null;
    api_key: string; // uuid
    created_at?: string | null;
    updated_at?: string | null;
    last_fetched_at?: string | null;
};

async function getUserByApiKey(apiKey: string) {
    try {
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('steam_id, avatar_url, display_name, tier, api_key')
            .eq('api_key', apiKey)
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Supabase getUserByApiKey error:', error);
            return null;
        }
        if (!data) return null;

        return data;
    } catch (e) {
        console.error('getUserByApiKey exception:', e);
        return null;
    }
}

function getSteamID64FromCookie(req: VercelRequest): string | null {
    const rawCookies = req.headers.cookie || '';
    const match = rawCookies.match(/fp_session=([^;]+)/);
    if (!match) return null;
    try {
        const token = match[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as { steamID64: string };
        return payload.steamID64;
    } catch (err) {
        console.error('Invalid session token', err);
        return null;
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") return res.status(200).end();

    try {
        let user: DBUser | null = null;
        let steamID64: string | null = null;

        // Try API key auth first
        const auth = (req.headers.authorization as string) || '';
        if (auth.startsWith('Bearer ')) {
            const apiKey = auth.slice(7).trim();
            if (apiKey) {
                user = await getUserByApiKey(apiKey);
                steamID64 = user?.steam_id || null;
            }
        }

        // Fallback to cookie auth
        if (!user) {
            steamID64 = getSteamID64FromCookie(req);
            if (steamID64) {
                const { data } = await supabase
                    .from(TABLE_NAME)
                    .select('steam_id, avatar_url, display_name, tier, api_key')
                    .eq('steam_id', steamID64)
                    .limit(1)
                    .maybeSingle();
                user = data ?? null;
            }
        }

        if (!user || !steamID64) {
            return res.status(200).json({ loggedIn: false });
        }

        // Load subscription
        const now = new Date();
        const { data: sub } = await supabase
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

        // Get FF balance
        const { data: ledger, error: ledgerError } = await supabase
            .from('ff_ledger')
            .select('amount')
            .eq('steam_id', steamID64);

        if (ledgerError) {
            console.error('Ledger fetch error:', ledgerError);
        }

        const ff_balance = ledger?.reduce((sum, row) => sum + row.amount, 0) || 0;

        return res.status(200).json({
            loggedIn: true,
            steamID64,
            displayName: user.display_name ?? steamID64,
            avatarUrl: user.avatar_url ?? '',
            tier,
            ff_balance,
            subscriptionExpiresAt,
            apiKey: user.api_key
        });
    } catch (err) {
        console.error('me endpoint error', err);
        return res.status(500).json({ error: 'Internal error' });
    }
}
