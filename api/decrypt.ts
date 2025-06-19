import crypto from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const key = process.env.CONFIG_ENCRYPTION_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Set common CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'https://csfloat.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle CORS preflight request
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    try {
        const { encrypted } = req.body as { encrypted: string };

        if (!encrypted || !encrypted.includes(":")) {
            return res.status(400).json({ error: "Missing or invalid payload." });
        }

        const [ivHex, encryptedHex] = encrypted.split(":");
        const iv = Buffer.from(ivHex, "hex");
        const encryptedBuffer = Buffer.from(encryptedHex, "hex");

        const decipher = crypto.createDecipheriv(
            "aes-256-cbc",
            Buffer.from(key, "hex"),
            iv
        );

        let decrypted = decipher.update(encryptedBuffer);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return res.status(200).json({ code: decrypted.toString("utf8") });
    } catch (err) {
        console.error("[decrypt-config] Failed to decrypt:", err);
        return res.status(500).json({ error: "Failed to decrypt" });
    }
}
