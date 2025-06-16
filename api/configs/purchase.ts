import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSteamID64 } from '../_utils/session.js'

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { config_id, cost } = req.body;
    const steamID = getSteamID64(req);

    if (!steamID || !config_id || typeof cost !== 'number') {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const now = new Date();
    const nowIso = now.toISOString();

    // Calculate user's FF balance from ff_ledger
    const { data: userLedgerRows, error: userLedgerError } = await supabase
        .from('ff_ledger')
        .select('amount')
        .eq('steam_id', steamID);

    if (userLedgerError) {
        console.error('Ledger fetch error:', userLedgerError);
        return res.status(500).json({ error: 'Failed to fetch FF balance' });
    }

    const ff_balance = userLedgerRows?.reduce((sum, row) => sum + row.amount, 0) ?? 0;

    if (ff_balance < cost) {
        return res.status(400).json({ error: 'Insufficient FF' });
    }

    const { data: configData, error: configError } = await supabase
        .from('configs')
        .select('creator_steam_id')
        .eq('id', config_id)
        .single();

    if (configError || !configData) {
        return res.status(400).json({ error: 'Invalid config ID' });
    }

    const sellerSteamID = configData.creator_steam_id;

    const { error: purchaseError } = await supabase
        .from('config_purchases')
        .insert({ config_id, buyer_steam_id: steamID });

    if (purchaseError) {
        console.error('Purchase insert error:', purchaseError);
        return res.status(500).json({ error: 'Failed to complete purchase' });
    }

    // Insert FF ledger and transaction for buyer
    const { error: ledgerInsertError } = await supabase
        .from('ff_ledger')
        .insert([{
            steam_id: steamID,
            amount: -cost,
            type: 'purchase',
            reference: config_id,
            created_at: nowIso
        }]);

    const { error: transactionError } = await supabase
        .from('transactions')
        .insert([{
            steam_id: steamID,
            type: 'config_purchase',
            ff_before: ff_balance,
            ff_after: ff_balance - cost,
            created_at: nowIso
        }]);

    if (ledgerInsertError || transactionError) {
        console.error('Ledger/Transaction error:', ledgerInsertError || transactionError);
        return res.status(500).json({ error: 'Failed to update FF balance' });
    }

    // Calculate seller FF balance from ff_ledger
    const { data: sellerLedgerRows, error: sellerLedgerError } = await supabase
        .from('ff_ledger')
        .select('amount')
        .eq('steam_id', sellerSteamID);

    if (sellerLedgerError) {
        console.error('Seller ledger fetch error:', sellerLedgerError);
        return res.status(500).json({ error: 'Failed to fetch seller FF balance' });
    }

    const seller_balance = sellerLedgerRows?.reduce((sum, row) => sum + row.amount, 0) ?? 0;

    const { error: sellerLedgerInsertError } = await supabase
        .from('ff_ledger')
        .insert([{
            steam_id: sellerSteamID,
            amount: Math.floor(cost * 0.7),
            type: 'config_sale',
            reference: config_id,
            created_at: nowIso
        }]);

    const { error: sellerTransactionError } = await supabase
        .from('transactions')
        .insert({
            steam_id: sellerSteamID,
            type: 'config_sale',
            ff_before: seller_balance,
            ff_after: seller_balance + Math.floor(cost * 0.7),
            created_at: nowIso
        });

    if (sellerLedgerInsertError || sellerTransactionError) {
        console.error('Seller Ledger/Transaction error:', sellerLedgerInsertError || sellerTransactionError);
        return res.status(500).json({ error: 'Failed to credit seller' });
    }

    // Increment config's purchase_count
    const { error: updateConfigError } = await supabase.rpc('increment_config_purchase_count', {
        config_id_param: config_id
    });

    if (updateConfigError) {
        console.error('Failed to increment purchase_count:', updateConfigError);
        return res.status(500).json({ error: 'Purchase completed but failed to update purchase count' });
    }

    return res.status(200).json({ success: true });
}
