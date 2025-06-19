// sw.ts – MV3 service worker (typed, lint-clean)
console.log("[SW] Loaded")
// --- constants --------------------------------------------------------------
const OFFSCREEN_URL = chrome.runtime.getURL('offscreen/offscreen.html');
const OFFSCREEN_REASON = chrome.offscreen.Reason.IFRAME_SCRIPTING;

let offscreenReady = false;

// --- helpers ----------------------------------------------------------------
async function ensureOffscreen(): Promise<void> {
    if (offscreenReady) return;

    try {
        await chrome.offscreen.createDocument({
            url: OFFSCREEN_URL,
            reasons: [OFFSCREEN_REASON],
            justification: 'Decrypt config code securely via extension context',
        });
        offscreenReady = true;
    } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('already exists')) {
            offscreenReady = true;
        } else {
            console.error('Failed to create offscreen document:', err);
            throw err;
        }
    }
}

// --- message plumbing -------------------------------------------------------
interface DecryptConfigRequest {
    cmd: 'decryptConfig';
    encrypted: string;
}

interface SWToOffscreen {
    target: 'offscreen';
    id: string;
    encrypted: string;
}

interface OffscreenReply {
    from: 'offscreen';
    id: string;
    payload?: unknown;
    error?: string;
}

type PendingResolver = {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
};

const pending = new Map<string, PendingResolver>();

// ← responses from off-screen
chrome.runtime.onMessage.addListener((msg) => {
    if ((msg as OffscreenReply)?.from !== 'offscreen') return;

    const { id, payload, error } = msg as OffscreenReply;
    const waiter = pending.get(id);
    if (!waiter) return;

    pending.delete(id);
    error ? waiter.reject(error) : waiter.resolve(payload);
});

// ↪ requests from content-scripts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if ((msg as DecryptConfigRequest)?.cmd !== 'decryptConfig') return;

    (async () => {
        try {
            await ensureOffscreen();

            const id = crypto.randomUUID();

            const reply = new Promise((resolve, reject) => {
                pending.set(id, { resolve, reject });
                setTimeout(() => {
                    if (pending.has(id)) {
                        pending.delete(id);
                        reject(new Error('Off-screen timeout'));
                    }
                }, 15000);
            });

            chrome.runtime.sendMessage({
                target: 'offscreen',
                id,
                encrypted: msg.encrypted,
            } satisfies SWToOffscreen);

            const payload = await reply;
            sendResponse({ ok: true, payload });
        } catch (e) {
            console.error('DecryptConfig handler failed:', e);
            sendResponse({ ok: false, error: `${e}` });
        }
    })();

    return true; // signal async
});
