function parseEstimatedValue(el: Element | null): number | null {
    if (!el) return null;
    const match = el.textContent?.match(/~\$(\d+(\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
}

async function evaluateProfitabilityOnce() {
    const userData = await new Promise<any>((resolve) => {
        chrome.storage.local.get(null, resolve);
    });

    const steamID = userData["floatpilot_user"]?.steamID64;
    const settings = userData[`floatpilot_settings_${steamID}`];
    const resaleThreshold = settings?.profitTarget || 10;

    document.querySelectorAll("item-card").forEach(card => {
        if ((card as HTMLElement).dataset.profitEvaluated === 'true') return;

        const estimationEl = card.querySelector(".estimation-tag");
        const estimatedValue = parseEstimatedValue(estimationEl);
        if (estimatedValue === null) return;

        const priceEl = card.querySelector(".price");
        const priceText = priceEl?.textContent || '';
        const priceValue = parseFloat(priceText.replace(/[^\d.]/g, ''));
        if (!Number.isFinite(priceValue)) return;

        let color = '#4a1a1a'; // red = not profitable

        const directProfitable = estimatedValue * (100 / (100 + resaleThreshold)) >= priceValue;

        let bargainProfitable = false;
        try {
            const dataAttr = card.getAttribute("data-csfloat-data");
            if (dataAttr) {
                const parsed = JSON.parse(dataAttr);
                const minOfferPrice = parsed?.min_offer_price / 100;
                bargainProfitable = estimatedValue * (100 / (100 + resaleThreshold)) >= minOfferPrice;
            }
        } catch (e) {
            console.warn('[ProfitCheck] Failed to parse data-csfloat-data:', e);
        }

        if (directProfitable) color = '#1e3f1f'; // green
        else if (bargainProfitable) color = '#807300'; // yellow

        const matCard = card.querySelector("mat-card");
        if (matCard) (matCard as HTMLElement).style.backgroundColor = color;

        const actions = card.querySelector(".outer-actions");
        if (actions) (actions as HTMLElement).style.backgroundColor = color;

        (card as HTMLElement).dataset.profitEvaluated = 'true';
    });
}

// Debounce wrapper
let timeout: NodeJS.Timeout | null = null;
function evaluateProfitabilityDebounced() {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
        evaluateProfitabilityOnce();
    }, 300);
}

// Initial run
evaluateProfitabilityOnce();

// Smarter MutationObserver
new MutationObserver((mutations) => {
    if (mutations.some(m => [...m.addedNodes].some(node => (node as HTMLElement)?.tagName === "ITEM-CARD"))) {
        evaluateProfitabilityDebounced();
    }
}).observe(document.body, {
    childList: true,
    subtree: true,
});
