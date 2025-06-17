import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { config_id } = req.body;
    const steamID = req.headers['x-steamid'];

    if (!config_id || typeof steamID !== 'string') {
        return res.status(400).json({ error: 'Missing config_id or steam ID' });
    }

    // Step 1: Confirm the config exists and belongs to the user
    const { data: config, error: fetchError } = await supabase
        .from('configs')
        .select('creator_steam_id')
        .eq('id', config_id)
        .single();

    if (fetchError || !config) {
        return res.status(404).json({ error: 'Config not found' });
    }

    if (config.creator_steam_id !== steamID) {
        return res.status(403).json({ error: 'You do not have permission to delete this config' });
    }

    // Step 2: Delete the config
    const { error: deleteError } = await supabase
        .from('configs')
        .delete()
        .eq('id', config_id);

    if (deleteError) {
        console.error('Failed to delete config:', deleteError);
        return res.status(500).json({ error: 'Failed to delete config' });
    }

    return res.status(200).json({ success: true });
}
