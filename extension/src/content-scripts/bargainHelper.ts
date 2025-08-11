// Utility to parse offer amounts like "$103.04"
(() => {
    //let lastRenderSignature = null;

    // ---------- Helpers ----------
    const toMoney = (cents: number) => (Math.round(cents) / 100).toFixed(2);
    const clamp2 = (v: number) => Math.round(v * 100) / 100;

    function parseOfferAmount(text: string): number {
        return parseFloat(text.replace(/[^0-9.]/g, ""));
    }

    function parseDiscount(text: string): number {
        const match = text.match(/\(([-\d.]+)% off\)/i);
        if (!match) return 0;
        return parseFloat(match[1]);
    }

    // ---------- Types ----------
    interface OfferInfo {
        element: HTMLElement;
        amount: number;              // in dollars
        discountPercent: number;     // e.g. 4.3
        status: 'accepted' | 'rejected' | 'counter' | 'sent' | 'initial';
        isBuyer: boolean;
    }

    interface HeaderData {
        id: string;
        price: number;               // cents
        min_offer_price?: number;    // cents
        reference?: { base_price?: number };
        [k: string]: any;
    }

    // ---------- DOM extraction ----------
    function detectOffers(): OfferInfo[] {
        const historySections = document.querySelectorAll(".history");
        const offerBubbles = historySections.length >= 2
            ? Array.from(historySections[1].querySelectorAll(".offer-bubble"))
            : [];

        const offers: OfferInfo[] = [];

        for (const el of offerBubbles) {
            const subText = el.querySelector(".sub-text")?.textContent?.toLowerCase() || "";
            const amountText = el.querySelector(".price")?.textContent || "";
            const discountText = el.querySelector(".discount")?.textContent || "";

            const amount = parseOfferAmount(amountText);
            const discountPercent = parseDiscount(discountText);
            if (!amount) continue;

            let status: OfferInfo['status'] = "initial";
            const iconEl = el.querySelector("mat-icon");
            const iconName = iconEl?.getAttribute("data-mat-icon-name") || "";
            if (iconName === "offer_cancelled") status = "rejected";
            else if (iconName === "offer_accepted") status = "accepted";
            else if (iconName === "offer_received") status = "counter";
            else if (iconName === "offer_sent") status = "sent";

            const isBuyer = subText.includes("buyer");
            offers.push({ element: el as HTMLElement, amount, discountPercent, status, isBuyer });
        }

        return offers;
    }

    function findHeaderData(): HeaderData | null {
        const header = document.querySelector('.header[data-csfloat-data]') as HTMLElement | null;
        if (!header) return null;
        const raw = header.getAttribute('data-csfloat-data');
        if (!raw) return null;
        try {
            // attribute is HTML-encoded (e.g., &quot;)
            const decoded = raw.replace(/&quot;/g, '"');
            return JSON.parse(decoded) as HeaderData;
        } catch (e) {
            console.warn('Bargain Helper: failed to parse data-csfloat-data', e);
            return null;
        }
    }

    function ensureUIContainer(): HTMLElement | null {
        const historySections = document.querySelectorAll(".history");
        const target = historySections[1] as HTMLElement | undefined;
        if (!target) return null;
        let ui = target.querySelector('.fp-bargain-helper') as HTMLElement | null;
        if (!ui) {
            ui = document.createElement('div');
            ui.className = 'fp-bargain-helper';
            ui.style.marginTop = '12px';
            ui.style.padding = '12px';
            ui.style.borderRadius = '12px';
            ui.style.border = '1px solid rgba(255,255,255,0.08)';
            ui.style.background = 'linear-gradient(180deg, rgba(31,31,31,0.9), rgba(20,20,20,0.9))';
            ui.style.color = '#eaeaea';
            ui.style.fontSize = '14px';
            ui.style.display = 'flex';
            ui.style.gap = '12px';
            ui.style.alignItems = 'stretch';
            ui.style.flexWrap = 'wrap';
            target.appendChild(ui);
        }
        return ui;
    }

    function renderUI(preview: { increaseLabel: string; increaseSub: string; standLabel: string; standSub: string }) {
        // const signature = JSON.stringify(preview);
        // if (lastRenderSignature === signature) return;
        // lastRenderSignature = signature;

        const container = ensureUIContainer();
        if (!container) return;

        // Avoid re-render churn by diffing text content
        container.innerHTML = '';

        const title = document.createElement('div');
        title.textContent = 'Bargain Helper';
        title.style.fontWeight = '600';
        title.style.width = '100%';
        title.style.marginBottom = '4px';
        container.appendChild(title);

        const btn = (label: string, sub: string, id: string) => {
            const wrap = document.createElement('div');
            wrap.style.flex = '1 1 200px';
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '6px';

            const b = document.createElement('button');
            b.id = id;
            b.textContent = label;
            b.style.padding = '10px 12px';
            b.style.borderRadius = '10px';
            b.style.border = '1px solid rgba(255,255,255,0.12)';
            b.style.background = id.includes('increase') ? 'rgba(37, 99, 235, 0.9)' : 'rgba(75, 85, 99, 0.9)';
            b.style.color = '#fff';
            b.style.cursor = 'pointer';
            b.style.fontWeight = '600';

            const s = document.createElement('div');
            s.textContent = sub;
            s.style.opacity = '0.8';
            s.style.fontSize = '12px';

            wrap.appendChild(b);
            wrap.appendChild(s);
            return wrap;
        };

        container.appendChild(btn(preview.increaseLabel, preview.increaseSub, 'fp-increase-btn'));
        container.appendChild(btn(preview.standLabel, preview.standSub, 'fp-stand-btn'));
    }

    // ---------- Offer math ----------
    function computeIncreasePreview(listingPriceCents: number, lastBuyerDiscountPct: number): { nextOfferDollars: number, nextDiscountPct: number } {
        // Reduce discount by 1 percentage point (move 1% closer to listing)
        const nextDiscount = Math.max(0, clamp2(lastBuyerDiscountPct - 1));
        const listing = listingPriceCents / 100;
        const nextOffer = clamp2(listing * (1 - nextDiscount / 100));
        return { nextOfferDollars: nextOffer, nextDiscountPct: nextDiscount };
    }

    function buildPreview(): void {
        const header = findHeaderData();
        if (!header) return;

        const offers = detectOffers();
        if (!offers.length) return;

        // Find the latest buyer offer in the thread
        let lastBuyer: OfferInfo | undefined;
        for (let i = offers.length - 1; i >= 0; i--) {
            if (offers[i].isBuyer) { lastBuyer = offers[i]; break; }
        }

        // Only show helper if user can send an offer (a counter or a rejection exists)
        // const hasCounterOrRejection = offers.some(o => o.status === 'counter' || o.status === 'rejected');
        // if (!hasCounterOrRejection || !lastBuyer) return;
        if (!lastBuyer) return;
        const listingPriceCents = typeof header.price === 'number' ? header.price : (header.reference?.base_price ?? 0);
        const minOfferCents = header.min_offer_price ?? 0;

        const { nextOfferDollars, nextDiscountPct } = computeIncreasePreview(listingPriceCents, lastBuyer.discountPercent);

        const increaseLabel = `Increase bargain (+1%)`;
        const increaseSub = `$${nextOfferDollars.toFixed(2)} (${nextDiscountPct.toFixed(2)}% off)`;

        const standLabel = `Stand`;
        const standSub = `min offer: $${toMoney(minOfferCents)}`;
        renderUI({ increaseLabel, increaseSub, standLabel, standSub });
    }

    // ---------- Entry (settings-gated) ----------
    if (!("chrome" in window) || !chrome.storage?.local) {
        console.warn("Bargain Helper: chrome.storage.local not available");
        return;
    }

    chrome.storage.local.get(null, (all: any) => {
        try {
            const steamID = all["floatpilot_user"]?.steamID64;
            if (!steamID) return; // not logged in yet

            const settingsKey = `floatpilot_settings_${steamID}`;
            const settings = all[settingsKey];
            if (!settings?.bargainHelper) return; // feature disabled
            let scheduled = false;
            const scan = () => {
                if (scheduled) return;
                scheduled = true;
                requestAnimationFrame(() => {
                    buildPreview();
                    scheduled = false;
                });
            };

            // Initial + observe DOM
            scan();
            new MutationObserver(() => scan()).observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
            });

            // React to runtime setting changes
            chrome.storage.onChanged?.addListener((changes, areaName) => {
                if (areaName !== 'local') return;
                if (changes[settingsKey]) {
                    const enabled = (changes[settingsKey].newValue || {}).bargainHelperio;
                    if (enabled) scan();
                }
            });
        } catch (e) {
            console.error("Bargain Helper init error:", e);
        }
    });
})();
