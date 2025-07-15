function logMemory(label: string) {
    const used = process.memoryUsage();
    console.log(`[Memory] ${label}: Heap=${(used.heapUsed / 1024 / 1024).toFixed(2)} MB, RSS=${(used.rss / 1024 / 1024).toFixed(2)} MB, External=${(used.external / 1024 / 1024).toFixed(2)} MB, Buffers=${(used.arrayBuffers / 1024 / 1024).toFixed(2)} MB`);
}
logMemory("Before import0");
logMemory("Before import1");
import {createClient} from '@supabase/supabase-js';
logMemory("Before import2");
import {NodeVM} from 'vm2';
logMemory("Before import3");

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
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

    const listingsArray = req.body.listingsArray;

    if (!Array.isArray(listingsArray)) {
        return res.status(400).json({error: "Expected listingsArray in body"});
    }

    logMemory("Before estimation batch");

    try {
        const results = await Promise.all(listingsArray.map(async ({item, configId}, index) => {
            try {
                logMemory(`Item ${index} - Start`);

                if (!item?.market_hash_name || typeof item.market_hash_name !== 'string') {
                    throw new Error("Missing or invalid item.market_hash_name");
                }

                const { data: configData, error: configError } = await supabase
                    .from('configs')
                    .select('encrypted_code')
                    .eq('id', configId)
                    .single();

                logMemory(`Item ${index} - After config fetch`);

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

                logMemory(`Item ${index} - After sales fetch (${data?.length || 0} rows)`);

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

                logMemory(`Item ${index} - After VM created`);

                const wrappedCode = `module.exports = function(listings, item) { ${code}\nreturn typeof run === 'function' ? run(listings, item) : null; }`;
                const estimationFn = vm.run(wrappedCode);

                logMemory(`Item ${index} - After code injected`);

                const result = estimationFn(data, item);

                logMemory(`Item ${index} - After estimation`);

                return result;
            } catch (innerErr: any) {
                return `error_in_run_${index}: ${innerErr.message}`;
            }
        }));

        logMemory("After all estimations");

        return res.status(200).json({prices: results});
    } catch (err: any) {
        console.error("Estimation batch failed:", err);
        return res.status(500).json({error: "Estimation execution failed", details: err.message});
    }
}
