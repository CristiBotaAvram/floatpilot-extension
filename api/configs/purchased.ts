import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const allowedOrigins = [
    'chrome-extension://ofhmnebacgcnibbclefjkojejehaigbh',
    'https://floatpilot.store',
    'https://www.floatpilot.store'
];

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const origin = req.headers.origin || '';
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-steamid');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const steamID = req.headers['x-steamid'] as string;
        if (!steamID) {
            console.warn('[CORS] Missing SteamID header');
            return res.status(401).json({ error: 'Unauthorized: missing steamID' });
        }

        const { data, error } = await supabase
            .from('config_purchases')
            .select('config_id')
            .eq('buyer_steam_id', steamID);

        if (error) {
            console.error('[Supabase] Error:', error.message);
            return res.status(500).json({ error: 'Failed to fetch purchased configs' });
        }

        return res.status(200).json(data);
    } catch (err: any) {
        console.error('[Unhandled Error]', err);
        return res.status(500).json({ error: 'Unexpected server error' });
    }
}
