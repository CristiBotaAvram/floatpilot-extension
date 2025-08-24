import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, description, ff_price, code , is_private } = req.body;
    if (!name || !ff_price || !code) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const steamID = req.headers['x-steamid'];
    if (!steamID) return res.status(401).json({ error: 'Unauthorized' });

    // Fetch user info
    const { data: user, error: userErr } = await supabase
        .from('users')
        .select('tier')
        .eq('steam_id', steamID)
        .single();

    if (userErr || !user) {
        return res.status(403).json({ error: 'Could not verify user' });
    }

    // Fetch count of existing configs by this user
    const { count, error: countErr } = await supabase
        .from('configs')
        .select('*', { count: 'exact', head: true })
        .eq('creator_steam_id', steamID);

    if (countErr) {
        return res.status(500).json({ error: 'Failed to count configs' });
    }
    const tier = req.headers['x-tier'];
    // Restriction: only Pro users can upload more than 0 configs
    if (tier !== 'Pro') {
        return res.status(403).json({ error: 'Only Pro users can upload configs!' });
    }

    // Optional: After 5 configs, charge FF to go up to 25
    if (count > 100 ) {
        return res.status(403).json({ error: 'You can only upload 25 configs!' });
    }

    const { data: insertedConfig, error: insertErr } = await supabase
        .from('configs')
        .insert({
            name: name,
            description: description,
            encrypted_code: code,
            ff_price: ff_price,
            creator_steam_id: steamID,
            is_private: is_private
        })
        .select()
        .single();

    if (insertErr || !insertedConfig) {
        console.error('Upload failed:', insertErr);
        return res.status(500).json({ error: 'Failed to upload config' });
    }

    // Mark the config as owned by creator
    const { error: purchaseErr } = await supabase.from('config_purchases').insert({
        buyer_steam_id: steamID,
        config_id: insertedConfig.id
    });

    if (purchaseErr) {
        console.error('Failed to mark config as owned:', purchaseErr);
    }

    return res.status(200).json({ success: true });
}
