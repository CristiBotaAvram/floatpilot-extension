import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const crypto = await import('crypto');
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
    if (tier !== 'Pro' && count >= 1) {
        return res.status(403).json({ error: 'Only Pro users can upload more than one config.' });
    }

    // Optional: After 5 configs, charge FF to go up to 25
    if (count >= 5 && count < 25) {
        const cost = 100; // FF cost to upload more than 5 configs

        // Calculate total FF by summing ledger history
        const { data: ledgerEntries, error: ledgerError } = await supabase
            .from('ff_ledger')
            .select('amount')
            .eq('steam_id', steamID);

        if (ledgerError || !ledgerEntries) {
            return res.status(500).json({ error: 'Could not retrieve FF ledger' });
        }

        const ffBalance = ledgerEntries.reduce((acc, entry) => acc + entry.amount, 0);

        if (ffBalance < cost) {
            return res.status(403).json({ error: 'Not enough FF to upload more configs' });
        }

        // Deduct FF
        await supabase.from('ff_ledger').insert({ steam_id: steamID, amount: -cost, type: 'config_upload', reference: 'Upload config beyond free limit' });
        await supabase.from('transactions').insert({
            steam_id: steamID,
            type: 'config_upload',
            ff_before: ffBalance,
            ff_after: ffBalance - cost,
        });
    }

    // Insert the config and return the inserted row
    const encryptionKey = process.env.CONFIG_ENCRYPTION_KEY!;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);
    let encrypted = cipher.update(code, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const encryptedCode = iv.toString('hex') + ':' + encrypted
    const { data: insertedConfig, error: insertErr } = await supabase
        .from('configs')
        .insert({
            name: name,
            description: description,
            encrypted_code: encryptedCode,
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
