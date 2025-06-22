import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
    const listingsArray = req.body.listingsArray; // Array of { item, listings, code }

    if (!Array.isArray(listingsArray)) {
        return res.status(400).json({ error: "Expected listingsArray in body" });
    }

    try {
        const results = listingsArray.map(({ listings, item, code }) => {
            const estimationFn = new Function("listings", "item", code);
            return estimationFn(listings, item);
        });

        return res.status(200).json({ prices: results });
    } catch (err: any) {
        console.error("Estimation batch failed:", err);
        return res.status(500).json({ error: "Estimation execution failed" });
    }
}
