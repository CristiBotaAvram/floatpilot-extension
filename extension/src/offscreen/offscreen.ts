// offscreen.ts – Runs in offscreen document context

interface DecryptRequest {
    target: 'offscreen';
    id: string;
    encrypted: string;
}

interface DecryptResponse {
    from: 'offscreen';
    id: string;
    payload?: unknown;
    error?: string;
}

chrome.runtime.onMessage.addListener(async (msg: DecryptRequest) => {
    if (msg?.target !== 'offscreen') return;

    const { id, encrypted } = msg;

    try {
        const res = await fetch('https://floatpilot.store/api/decrypt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ encrypted }),
            credentials: 'omit'
        });

        if (!res.ok) throw new Error(`Decryption failed with status ${res.status}`);

        const json = await res.json();

        chrome.runtime.sendMessage(<DecryptResponse>{
            from: 'offscreen',
            id,
            payload: json,
        });
    } catch (err) {
        chrome.runtime.sendMessage(<DecryptResponse>{
            from: 'offscreen',
            id,
            error: err instanceof Error ? err.message : String(err),
        });
    }
});
