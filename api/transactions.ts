// /api/transactions.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getSteamID64 } from './_utils/session.js'; // your session logic

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const steamID64 = getSteamID64(req);
    if (!steamID64) {
        return res.status(200).json({ transactions: [] });
    }

    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('steam_id', steamID64)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching transactions:', error);
        return res.status(500).json({ error: 'Database error' });
    }

    return res.status(200).json({ transactions: data });
}
