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
            justification: 'Fetch CSFloat listings with first-party cookies',
        });
        offscreenReady = true;
    } catch (err: unknown) {
        // already exists → benign
        if (err instanceof Error && err.message.includes('already exists')) {
            offscreenReady = true;
        } else {
            throw err;
        }
    }
}

// --- message plumbing -------------------------------------------------------
interface FetchRequest {
    cmd: 'fetchListing';
    name: string;
}
interface SWToOffscreen {
    target: 'offscreen';
    id: string;
    name: string;
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
chrome.runtime.onMessage.addListener((msg: OffscreenReply) => {
    if (msg?.from !== 'offscreen') return;

    const { id, payload, error } = msg;
    const waiter = pending.get(id);
    if (!waiter) return;

    pending.delete(id);
    error ? waiter.reject(error) : waiter.resolve(payload);
});

// ↪ requests from content-scripts
chrome.runtime.onMessage.addListener(
    (msg: FetchRequest, _sender, sendResponse) => {
        if (msg?.cmd !== 'fetchListing') return;

        (async () => {
            try {
                await ensureOffscreen();

                const id = crypto.randomUUID();

                // create promise before sending
                const reply = new Promise((resolve, reject) => {
                    pending.set(id, { resolve, reject });

                    // safety timeout
                    setTimeout(() => {
                        if (pending.has(id)) {
                            pending.delete(id);
                            reject(new Error('Off-screen timeout'));
                        }
                    }, 15_000);
                });

                // hand off to off-screen document
                chrome.runtime.sendMessage(<SWToOffscreen>{
                    target: 'offscreen',
                    id,
                    name: msg.name,
                });

                const payload = await reply;
                sendResponse({ ok: true, payload });
            } catch (e) {
                sendResponse({ ok: false, error: `${e}` });
            }
        })();

        return true; // keep the channel open (async)
    }
);
