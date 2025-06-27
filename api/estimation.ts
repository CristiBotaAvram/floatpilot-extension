import type { VercelRequest, VercelResponse } from '@vercel/node';
import LZString from 'lz-string';

export default function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    const listingsArray = req.body.listingsArray;

    if (!Array.isArray(listingsArray)) {
        return res.status(400).json({ error: "Expected listingsArray in body" });
    }

    try {
        const results = listingsArray.map(({ listings, item, code }, index) => {
            try {
                if (listings && typeof listings === "object" && 'compressed' in listings) {
                    const decompressed = LZString.decompressFromUTF16(listings.compressed);
                    listings = decompressed ? JSON.parse(decompressed) : [];
                }

                const estimationFn = new Function("listings", "item", `
                    ${code}
                    return typeof run === 'function' ? run(listings, item) : null;
                `);
                return estimationFn(listings, item);

            } catch (innerErr) {
                return `error_in_run_${index}: ${innerErr.message}`;
            }
        });

        return res.status(200).json({ prices: results });
    } catch (err: any) {
        console.error("Estimation batch failed:", err);
        return res.status(500).json({ error: "Estimation execution failed", details: err.message });
    }
}
