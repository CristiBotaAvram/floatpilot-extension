// offscreen.ts – Runs in offscreen document context

chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.target !== 'offscreen') return;

    const { id, encrypted } = msg;

    (async () => {
        try {
            const res = await fetch('https://floatpilot.store/api/decrypt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ encrypted }),
                credentials: 'include',
            });

            if (!res.ok) throw new Error(`Status ${res.status}`);

            const json = await res.json();

            chrome.runtime.sendMessage({
                from: 'offscreen',
                id,
                payload: json,
            });
        } catch (err) {
            chrome.runtime.sendMessage({
                from: 'offscreen',
                id,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    })();
});
