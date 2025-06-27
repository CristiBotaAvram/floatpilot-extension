import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import LZString from 'lz-string';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    const { name } = req.query;
    if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid name param' });
    }

    const { data, error } = await supabase
        .from('csfloat_sales')
        .select('float_value, sale_price, sale_date, fade_percent, playside_blue, backside_blue, stickers')
        .eq('market_hash_name', name)
        .eq('stickers', '"[]"')
        .order('sale_date', { ascending: false });

    if (error) {
        console.error('[API] Supabase error:', error.message);
        return res.status(500).json({ error: 'Failed to fetch sales' });
    }

    const compressed = LZString.compressToUTF16(JSON.stringify(data));

    return res.status(200).json({ compressed });
}
