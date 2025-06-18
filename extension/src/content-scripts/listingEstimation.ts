console.log('[FloatPilot] Content script loaded on CSFloat.');

const observer = new MutationObserver(() => {
    const cards = [...document.querySelectorAll('.listing-card')];
    if (cards.length > 0) {
        observer.disconnect();
        handleListings(cards);
    }
});

observer.observe(document.body, { childList: true, subtree: true });

async function handleListings(cards: Element[]) {
    console.log('[FloatPilot] Found listing cards:', cards.length);

    const { floatpilot_user } = await chrome.storage.local.get('floatpilot_user');
    const steamID = floatpilot_user?.steamID64;
    if (!steamID) return;

    const key = `floatpilot_settings_${steamID}`;
    const result = await chrome.storage.local.get(key);
    const settings = result[key];
    const config = settings?.selectedConfig;

    if (!config || !settings.itemEstimation) {
        console.warn('[FloatPilot] No config selected or item estimation is off.');
        return;
    }

    const decryptedCode = atob(config.encrypted_code);
    console.log('[FloatPilot] Decrypted config loaded');

    try {
        const scriptFn = new Function('listings', decryptedCode);
        const listingData = extractListingData(cards);
        const estimates = scriptFn(listingData);
        applyEstimatesToCards(cards, estimates);
    } catch (err) {
        console.error('[FloatPilot] Failed to evaluate config:', err);
    }
}

function extractListingData(cards: Element[]): any[] {
    return cards.map(card => {
        // Example: extract price and float from card
        const priceEl = card.querySelector('.price') as HTMLElement;
        const floatEl = card.querySelector('.float-value') as HTMLElement;

        return {
            price: parseFloat(priceEl?.innerText.replace('$', '') || '0'),
            float: parseFloat(floatEl?.innerText || '0'),
            // Add more as needed (stickers, phase, etc.)
        };
    });
}

function applyEstimatesToCards(cards: Element[], estimates: any[]) {
    cards.forEach((card, idx) => {
        const estimate = estimates?.[idx];
        if (estimate == null) return;

        const tag = document.createElement('div');
        tag.textContent = `Estimated: $${estimate.toFixed(2)}`;
        tag.style.color = 'lime';
        tag.style.fontWeight = 'bold';
        tag.style.marginTop = '4px';

        card.appendChild(tag);
    });
}
