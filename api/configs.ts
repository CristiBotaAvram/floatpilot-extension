import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const idsParam = req.query.ids;

    let query = supabase
        .from('configs')
        .select('id, name, description, encrypted_code, creator_steam_id, ff_price, purchase_count, created_at, is_private');

    // If IDs are passed → fetch by ID (regardless of privacy)
    if (idsParam) {
        const idsArray = Array.isArray(idsParam)
            ? idsParam.flatMap(val => val.split(',').map(s => s.trim()))
            : idsParam.split(',').map(s => s.trim());

        query = query.in('id', idsArray);
    } else {
        // If no IDs → only return public configs
        query = query.eq('is_private', false).order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: 'Failed to fetch configs' });
    }

    return res.status(200).json(data);
}
