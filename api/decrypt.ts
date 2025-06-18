// /api/decrypt-config.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

// Key must be 32 bytes (hex string of 64 characters for AES-256)
const key = Buffer.from(process.env.CONFIG_DECRYPT_KEY!, 'hex');

export default function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { encrypted } = req.body;
    if (!encrypted || typeof encrypted !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid encrypted payload' });
    }

    try {
        const ivHex = encrypted.slice(0, 32); // First 16 bytes (32 hex chars)
        const dataHex = encrypted.slice(32); // Remainder

        const iv = Buffer.from(ivHex, 'hex');
        const encryptedData = Buffer.from(dataHex, 'hex');

        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedData);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return res.status(200).json({ code: decrypted.toString('utf8') });
    } catch (err) {
        console.error('[decrypt-config] Failed to decrypt:', err);
        return res.status(500).json({ error: 'Failed to decrypt config' });
    }
}
