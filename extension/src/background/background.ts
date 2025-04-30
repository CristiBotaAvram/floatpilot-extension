// FloatPilot – background service worker (MV3)
// Handles: 1) searchCSFloat requests, 2) key retrieval for content scripts.

console.log("✅ FloatPilot background loaded");

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    /* ------------------------------------------------------------
       1. Provide the stored API key back to popup/content scripts
    -------------------------------------------------------------*/
    if (message.type === 'getApiKey') {
        chrome.storage.local.get('apiKey', ({ apiKey }) => sendResponse(apiKey ?? ''));
        return true; // keep the channel open for async response
    }

    /* ------------------------------------------------------------
       2. Forward search requests to CSFloat using stored API key
    -------------------------------------------------------------*/
    if (message.type === 'searchCSFloat') {
        chrome.storage.local.get('apiKey', ({ apiKey }) => {
            if (!apiKey) {
                console.warn('[FloatPilot] No API key saved – aborting search');
                sendResponse({ success: false, error: 'no_api_key' });
                return;
            }

            const buildUrl = (includeFloat: boolean): string => {
                const params = new URLSearchParams({
                    market_hash_name: message.itemName,
                    sort_by: 'lowest_price',
                    limit: '1',
                });
                if (includeFloat && message.maxFloat != null) params.set('max_float', message.maxFloat.toString());
                return `https://csfloat.com/api/v1/listings?${params.toString()}`;
            };

            const headers = {
                Authorization: apiKey,
                Accept: 'application/json',
            };

            // primary fetch (with max_float)
            fetch(buildUrl(true), { headers })
                .then((r) => {
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    return r.json();
                })
                .then((j) => {
                    if (j.data?.length) {
                        sendResponse({ success: true, data: j.data });
                    } else {
                        // fallback without max_float constraint
                        console.log('[FloatPilot] No results with float filter – retrying');
                        return fetch(buildUrl(false), { headers })
                            .then((r2) => {
                                if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
                                return r2.json();
                            })
                            .then((j2) => sendResponse({ success: true, data: j2.data }));
                    }
                })
                .catch((err) => {
                    console.error('[FloatPilot] CSFloat fetch error:', err);
                    sendResponse({ success: false, error: err.message });
                });
        });

        return true; // indicate async response
    }
});
