import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const allowedOrigin = 'chrome-extension://ofhmnebacgcnibbclefjkojejehaigbh';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const origin = req.headers.origin;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        if (origin === allowedOrigin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-steamid');
            return res.status(200).end();
        } else {
            return res.status(403).json({ error: 'Origin not allowed' });
        }
    }

    if (origin !== allowedOrigin) {
        return res.status(403).json({ error: 'Origin not allowed' });
    }

    // Set CORS headers for actual request
    res.setHeader('Access-Control-Allow-Origin', origin);

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
