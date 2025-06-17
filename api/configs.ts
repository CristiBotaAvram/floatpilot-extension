import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Only if secured behind server!
);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Support ?ids=... (comma-separated)
    const idsParam = req.query.ids;
    let query = supabase
        .from('configs')
        .select('id, name, description, creator_steam_id, ff_price, purchase_count, created_at')
        .order('created_at', { ascending: false })
        .eq('is_private', false);


    if (idsParam) {
        // idsParam may be a string or an array (but for us it will be a string)
        const idsArray = Array.isArray(idsParam)
            ? idsParam.flatMap(val => val.split(',').map(s => s.trim()))
            : idsParam.split(',').map(s => s.trim());
        query = query.in('id', idsArray);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: 'Failed to fetch configs' });
    }

    return res.status(200).json(data);
}
