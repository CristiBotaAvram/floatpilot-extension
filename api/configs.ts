import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// const allowedOrigins = [
//     'chrome-extension://ofhmnebacgcnibbclefjkojejehaigbh',
//     'https://floatpilot.store',
//     'https://www.floatpilot.store'
// ];

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // const origin = req.headers.origin || '';
    // if (allowedOrigins.includes(origin)) {
    //     res.setHeader('Access-Control-Allow-Origin', origin);
    // }
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-steamid');
    console.log('Configs API hit', {
        method: req.method,
        origin: req.headers.origin,
        ids: req.query.ids,
    });

    if (req.method === 'OPTIONS') return res.status(200).end(); // ✅ Preflight

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const idsParam = req.query.ids;

    let query = supabase
        .from('configs')
        .select('id, name, description, creator_steam_id, ff_price, purchase_count, created_at, is_private');

    if (idsParam) {
        const idsArray = Array.isArray(idsParam)
            ? idsParam.flatMap(val => val.split(',').map(s => s.trim()))
            : idsParam.split(',').map(s => s.trim());

        query = query.in('id', idsArray);
    } else {
        query = query.eq('is_private', false).order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: 'Failed to fetch configs' });
    }

    return res.status(200).json(data);
}
