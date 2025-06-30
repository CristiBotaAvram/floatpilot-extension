import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const listingsArray = req.body.listingsArray;

    if (!Array.isArray(listingsArray)) {
        return res.status(400).json({ error: "Expected listingsArray in body" });
    }

    try {
        const results = await Promise.all(listingsArray.map(async ({ item, code }, index) => {
            try {
                if (!item?.market_hash_name || typeof item.market_hash_name !== 'string') {
                    throw new Error("Missing or invalid item.market_hash_name");
                }

                const { data, error } = await supabase
                    .from('csfloat_sales')
                    .select('float_value, sale_price, sale_date, fade_percent, playside_blue, backside_blue, stickers')
                    .eq('market_hash_name', item.market_hash_name)
                    .eq('stickers', '"[]"')
                    .order('sale_date', { ascending: false });

                if (error) {
                    console.error(`[API] Supabase error for item ${item.market_hash_name}:`, error.message);
                    throw new Error("Failed to fetch sales data");
                }

                const estimationFn = new Function("listings", "item", `
                    ${code}
                    return typeof run === 'function' ? run(listings, item) : null;
                `);

                return estimationFn(data, item);

            } catch (innerErr: any) {
                return `error_in_run_${index}: ${innerErr.message}`;
            }
        }));

        return res.status(200).json({ prices: results });
    } catch (err: any) {
        console.error("Estimation batch failed:", err);
        return res.status(500).json({ error: "Estimation execution failed", details: err.message });
    }
}
