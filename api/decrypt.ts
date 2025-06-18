// /api/encrypt.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

// 32-byte hex key (AES-256)
const key = Buffer.from(process.env.CONFIG_ENCRYPTION_KEY!, 'hex');

export default function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { code } = req.body;
    if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid code' });
    }

    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(code, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);

        const result = Buffer.concat([iv, encrypted]).toString('hex');
        return res.status(200).json({ encrypted: result });
    } catch (err) {
        console.error('[encrypt-config] Failed to encrypt:', err);
        return res.status(500).json({ error: 'Failed to encrypt config' });
    }
}
