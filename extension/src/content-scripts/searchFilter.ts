// content-scripts/searchFilter.ts

(function () {
    // Only run on CSFloat search pages
    if (!location.href.includes('csfloat.com/search')) return;

    /**
     * MutationObserver: whenever CSFloat lazily adds new listings, we
     * immediately delete those belonging to Top‑Rated sellers (orange star).
     * No additional layout tweaks – we let the site keep its own grid.
     */
    const observer = new MutationObserver(removeStarredCards);

    /**
     * Delete every card that contains the orange‑filled star <path>.
     * Respects the FloatPilot setting `removeTopSeller`.
     */
    function removeStarredCards(): void {
        chrome.storage.local.get(null, (all) => {
            const userKey = Object.keys(all).find((k) => k.startsWith('floatpilot_settings_'));
            if (!userKey) return;
            const settings = all[userKey] as Record<string, boolean>;
            if (!settings?.removeTopSeller) return;

            const cards = document.querySelectorAll<HTMLElement>(
                'app-search-card, [class*="listing"], [class*="card"]'
            );

            cards.forEach((card) => {
                const star = card.querySelector('svg path[fill="#ff8c00"]');
                if (star) card.remove();
            });
        });
    }

    // Kick‑off: run once and then watch for dynamic content.
    removeStarredCards();
    observer.observe(document.body, { childList: true, subtree: true });
})();
