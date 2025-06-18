import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-steamid');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const steamID = req.headers['x-steamid'] as string;

    if (!steamID) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
        .from('config_purchases')
        .select('config_id')
        .eq('buyer_steam_id', steamID);

    if (error) {
        return res.status(500).json({ error: 'Failed to fetch purchased configs' });
    }

    res.status(200).json(data);
}
