// sw.ts – MV3 service worker (typed, lint-clean)

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
type Listener = Parameters<typeof chrome.runtime.onMessage.addListener>[0];
const handleOffscreenReply: Listener = (msg) => {
    if (msg?.from !== 'offscreen') return;

    const { id, payload, error } = msg as OffscreenReply;
    const waiter = pending.get(id);
    if (!waiter) return;

    pending.delete(id);
    error ? waiter.reject(error) : waiter.resolve(payload);
};

chrome.runtime.onMessage.addListener(handleOffscreenReply);

// ↪ requests from content-scripts
chrome.runtime.onMessage.addListener(
    (msg: DecryptConfigRequest, _sender, sendResponse) => {
        if (msg?.cmd !== 'decryptConfig') return;

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
                    }, 15_000);
                });

                chrome.runtime.sendMessage(<SWToOffscreen>{
                    target: 'offscreen',
                    id,
                    encrypted: msg.encrypted,
                });

                const payload = await reply;
                sendResponse({ ok: true, payload });
            } catch (e) {
                sendResponse({ ok: false, error: `${e}` });
            }
        })();

        return true;
    }
);
