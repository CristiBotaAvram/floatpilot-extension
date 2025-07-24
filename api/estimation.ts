import type {VercelRequest, VercelResponse} from '@vercel/node';
import {createClient} from '@supabase/supabase-js';
import {NodeVM} from 'vm2';

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
        return res.status(405).json({error: "Method Not Allowed"});
    }

    const apiKey = req.headers["x-api-key"];
    if (!apiKey || typeof apiKey !== "string") {
        return res.status(401).json({ error: "Missing API key" });
    }

    const { data: user, error } = await supabase
        .from("users")
        .select("steam_id")
        .eq("api_key", apiKey)
        .single();

    if (!user) return res.status(403).json({ error: "Invalid API key" });

    const now = new Date();

    // Get most recent active subscription
    const { data: sub, error: subError } = await supabase
        .from('subscriptions')
        .select('tier, expires_at')
        .eq('steam_id', user.steam_id)
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (sub && sub.expires_at && new Date(sub.expires_at) < now) {
        return res.status(401).json({ error: "Missing Pro subscription" });
    }
    const listingsArray = req.body.listingsArray;

    if (!Array.isArray(listingsArray)) {
        return res.status(400).json({error: "Expected listingsArray in body"});
    }

    try {
        const results = await Promise.all(listingsArray.map(async ({item, configId}, index) => {
            try {
                if (!item?.market_hash_name || typeof item.market_hash_name !== 'string') {
                    throw new Error("Missing or invalid item.market_hash_name");
                }

                const { data: configData, error: configError } = await supabase
                    .from('configs')
                    .select('encrypted_code')
                    .eq('id', configId)
                    .single();

                if (configError || !configData) {
                    throw new Error("Failed to retrieve config code");
                }

                const code = configData.encrypted_code;

                const {data, error} = await supabase
                    .from('csfloat_sales')
                    .select('float_value, sale_price, sale_date, fade_percent, playside_blue, backside_blue, stickers')
                    .eq('market_hash_name', item.market_hash_name)
                    .eq('stickers', '"[]"')
                    .order('sale_date', {ascending: false});

                if (error) {
                    console.error(`[API] Supabase error for item ${item.market_hash_name}:`, error.message);
                    throw new Error("Failed to fetch sales data");
                }

                const vm = new NodeVM({
                    console: 'inherit',
                    sandbox: {},
                    require: false,
                    eval: false,
                    wasm: false,
                    timeout: 500
                });

                const wrappedCode = `module.exports = function(listings, item) { ${code}\nreturn typeof run === 'function' ? run(listings, item) : null; }`;
                const estimationFn = vm.run(wrappedCode);
                return estimationFn(data, item);

            } catch (innerErr: any) {
                return `error_in_run_${index}: ${innerErr.message}`;
            }
        }));

        return res.status(200).json({prices: results});
    } catch (err: any) {
        console.error("Estimation batch failed:", err);
        return res.status(500).json({error: "Estimation execution failed", details: err.message});
    }
}