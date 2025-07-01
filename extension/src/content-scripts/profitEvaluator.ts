function parseEstimatedValue(el: Element | null): number | null {
    if (!el) return null;
    const match = el.textContent?.match(/~\$(\d+(\.\d+)?)/);
    return match ? parseFloat(match[1]) : null;
}

async function evaluateProfitability() {
    const userData = await new Promise<any>((resolve) => {
        chrome.storage.local.get(null, resolve);
    });

    const steamID = userData["floatpilot_user"]?.steamID64;
    const settings = userData[`floatpilot_settings_${steamID}`];
    let resaleThreshold = settings?.profitTarget;

    if (!resaleThreshold) {
        resaleThreshold = 10;
    }

    document.querySelectorAll("item-card").forEach(card => {
        if ((card as HTMLElement).dataset.profitEvaluated === 'true') return;

        // Remove reference widget
        const refWidget = card.querySelector(".reference-widget-container");
        if (refWidget) refWidget.remove();

        // Remove price badge widget
        const priceBadge = card.querySelector("app-price-icon");
        if (priceBadge) priceBadge.remove();

        const estimationEl = card.querySelector(".estimation-tag");
        const estimatedValue = parseEstimatedValue(estimationEl);
        if (estimatedValue === null) return;

        const priceEl = card.querySelector(".price");
        if (!priceEl) return;

        const priceText = priceEl.textContent || '';
        const priceValue = parseFloat(priceText.replace(/[^\d.]/g, ''));
        if (!Number.isFinite(priceValue)) return;

        let color = '#4a1a1a'; // default: not profitable

        const minPriceToBreakEven = estimatedValue * (100 / (100 + resaleThreshold));

        let directProfitable = priceValue <= minPriceToBreakEven;
        let bargainProfitable = false;

        const dataAttr = card.getAttribute("data-csfloat-data");
        if (dataAttr) {
            try {
                const parsed = JSON.parse(dataAttr);
                const minOfferPriceCents = parsed?.min_offer_price;
                const minOfferPrice = minOfferPriceCents / 100;

                bargainProfitable = minPriceToBreakEven >= minOfferPrice;
            } catch (e) {
                console.warn('[ProfitCheck] Failed to parse data-csfloat-data:', e);
            }
        }

        if (directProfitable) {
            color = '#1e3f1f'; // green
            estimationEl!.textContent = `$${priceValue.toFixed(2)} → ~$${estimatedValue.toFixed(2)}`;
        } else if (bargainProfitable) {
            color = '#807300'; // yellow
            estimationEl!.textContent = `~$${minPriceToBreakEven.toFixed(2)} → ~$${estimatedValue.toFixed(2)}`;
        }

        const matCard = card.querySelector("mat-card");
        if (matCard) (matCard as HTMLElement).style.backgroundColor = color;

        const actions = card.querySelector(".outer-actions");
        if (actions) (actions as HTMLElement).style.backgroundColor = color;

        (card as HTMLElement).dataset.profitEvaluated = 'true';
    });
}

// Initial scan
evaluateProfitability();

// Re-scan if new cards appear
new MutationObserver(evaluateProfitability).observe(document.body, { childList: true, subtree: true });
