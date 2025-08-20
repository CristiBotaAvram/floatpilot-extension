// Bargain Helper (fixed bottom, singleton, debounced)
(() => {
    if ((window as any).__fpBargainHelperMounted) return;
    (window as any).__fpBargainHelperMounted = true;

    let lastRenderSignature: string | null = null;
    let rafScheduled = false;
    let debounceTimer: number | null = null;

    const toMoney = (cents: number) => (Math.round(cents) / 100).toFixed(2);
    const clamp2 = (v: number) => Math.round(v * 100) / 100;

    function parseOfferAmount(text: string): number {
        return parseFloat(text.replace(/[^0-9.]/g, ""));
    }
    function parseDiscount(text: string): number {
        const m = text.match(/\(([-\d.]+)% off\)/i);
        return m ? parseFloat(m[1]) : 0;
    }

    interface OfferInfo {
        element: HTMLElement;
        amount: number;
        discountPercent: number;
        status: 'accepted' | 'rejected' | 'counter' | 'sent' | 'initial';
        isBuyer: boolean;
    }
    interface HeaderData {
        id: string;
        price: number;
        min_offer_price?: number;
        reference?: { base_price?: number };
        [k: string]: any;
    }

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
            const iconName = el.querySelector("mat-icon")?.getAttribute("data-mat-icon-name") || "";
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
            const decoded = raw.replace(/&quot;/g, '"');
            return JSON.parse(decoded) as HeaderData;
        } catch (e) {
            console.warn('Bargain Helper: failed to parse data-csfloat-data', e);
            return null;
        }
    }

    function ensureStickyUI(): HTMLElement | null {
        const historySections = document.querySelectorAll('.history');
        const container = (historySections.length >= 2 ? historySections[1] : null) as HTMLElement | null;
        if (!container) return null;

        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        let spacer = container.querySelector('#fp-bargain-helper-spacer') as HTMLElement | null;
        if (!spacer) {
            spacer = document.createElement('div');
            spacer.id = 'fp-bargain-helper-spacer';
            spacer.style.height = '88px';
            spacer.style.width = '100%';
            spacer.style.pointerEvents = 'none';
            container.appendChild(spacer);
        }

        let outer = container.querySelector('#fp-bargain-helper-sticky') as HTMLElement | null;
        if (!outer) {
            outer = document.createElement('div');
            outer.id = 'fp-bargain-helper-sticky';
            Object.assign(outer.style, {
                position: 'sticky',
                bottom: '0',
                left: '0',
                right: '0',
                width: '100%',
                zIndex: '10',
            } as CSSStyleDeclaration);

            const panel = document.createElement('div');
            panel.className = 'fp-bargain-helper-panel';
            Object.assign(panel.style, {
                margin: '12px 0',
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'linear-gradient(180deg, rgba(31,31,31,0.96), rgba(20,20,20,0.96))',
                color: '#eaeaea',
                fontSize: '14px',
                display: 'flex',
                gap: '12px',
                alignItems: 'stretch',
                flexWrap: 'wrap',
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            } as CSSStyleDeclaration);

            outer.appendChild(panel);
            container.appendChild(outer);
        }

        return outer.querySelector('.fp-bargain-helper-panel') as HTMLElement;
    }

    // ---------- Click pipeline helpers ----------
    let __fpSubmitting = false;

    function norm(s: string) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

    function findButtonByLabels(labels: string[]): HTMLButtonElement | null {
        const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[];
        const want = labels.map(norm);
        for (const b of buttons) {
            const text = norm(b.textContent || b.getAttribute('aria-label') || '');
            if (!text) continue;
            if (want.some(w => text === w || text.includes(w))) return b;
        }
        return null;
    }

    function queryVisible<T extends Element>(selector: string): T | null {
        const els = Array.from(document.querySelectorAll(selector)) as T[];
        return (els.find((e: any) => !!(e as any).offsetParent || (e as any).getClientRects().length) || null) as T | null;
    }

    function setInputValue(input: HTMLInputElement, value: string) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        nativeInputValueSetter?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async function submitOffer(amountDollars: number): Promise<boolean> {
        if (__fpSubmitting) return false;
        __fpSubmitting = true;
        try {
            // 1) Open offer form: handle Counter-Offer and New Offer
            const explicitCounterBtn = document.querySelector('.counter-btn') as HTMLButtonElement | null;
            const openBtn = explicitCounterBtn ||
                findButtonByLabels(['counter-offer', 'counter offer', 'new offer']);
            if (!openBtn) {
                console.warn('[Bargain Helper] Offer open button not found');
                return false;
            }
            openBtn.click();

            // 2) Wait for the amount input and fill value
            let input = queryVisible<HTMLInputElement>('input[formcontrolname="amount"]');
            const start = Date.now();
            while (!input && Date.now() - start < 6000) {
                await new Promise(r => setTimeout(r, 50));
                input = queryVisible<HTMLInputElement>('input[formcontrolname="amount"]');
            }
            if (!input) {
                console.warn('[Bargain Helper] Offer amount input not found');
                return false;
            }
            setInputValue(input, amountDollars.toFixed(2));

            // 3) Submit the offer: support various labels/classes
            const explicitMakeBtn = document.querySelector('.create-offer-btn') as HTMLButtonElement | null;
            const makeBtn = explicitMakeBtn ||
                findButtonByLabels(['make offer', 'send offer', 'create offer']);
            if (!makeBtn) {
                console.warn('[Bargain Helper] Make/Send Offer button not found');
                return false;
            }
            makeBtn.click();
            return true;
        } finally {
            __fpSubmitting = false;
        }
    }

    function renderUI(preview: { increaseLabel: string; increaseSub: string; standLabel: string; standSub: string; increaseAmount: number; standAmount: number }): void {
        const signature = JSON.stringify(preview);
        if (lastRenderSignature === signature) return;
        lastRenderSignature = signature;

        const container = ensureStickyUI();
        if (!container) return;
        container.innerHTML = '';

        const title = document.createElement('div');
        title.textContent = ' Bargain Helper';
        title.style.fontWeight = '600';
        title.style.width = '100%';
        title.style.marginBottom = '4px';
        container.appendChild(title);

        const btn = (label: string, sub: string, id: string, onClick: () => void) => {
            const wrap = document.createElement('div');
            wrap.style.flex = '1 1 200px';
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '6px';

            const b = document.createElement('button');
            b.id = id;
            b.textContent = label;
            Object.assign(b.style, {
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: id.includes('increase') ? 'rgba(37, 99, 235, 0.95)' : 'rgba(75, 85, 99, 0.95)',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: '600',
            } as CSSStyleDeclaration);
            b.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick();
            });

            const s = document.createElement('div');
            s.textContent = sub;
            s.style.opacity = '0.8';
            s.style.fontSize = '12px';

            wrap.appendChild(b);
            wrap.appendChild(s);
            return wrap;
        };

        container.appendChild(btn(preview.increaseLabel, preview.increaseSub, 'fp-increase-btn', () => submitOffer(preview.increaseAmount)));
        container.appendChild(btn(preview.standLabel, preview.standSub, 'fp-stand-btn', () => submitOffer(preview.standAmount)));
    }

    function computeIncreasePreview(listingPriceCents: number, lastBuyerDiscountPct: number) {
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

        let lastBuyer: OfferInfo | undefined;
        for (let i = offers.length - 1; i >= 0; i--) {
            if (offers[i].isBuyer) { lastBuyer = offers[i]; break; }
        }
        const hasCounterOrRejection = offers[offers.length - 1]?.status === 'counter' || offers[offers.length - 1]?.status === 'rejected';
        if (!hasCounterOrRejection || !lastBuyer) return;

        const listingPriceCents = typeof header.price === 'number' ? header.price : (header.reference?.base_price ?? 0);
        const minOfferCents = header.min_offer_price ?? 0;

        const { nextOfferDollars, nextDiscountPct } = computeIncreasePreview(listingPriceCents, lastBuyer.discountPercent);

        const increaseLabel = `Increase bargain (+1%)`;
        const increaseSub = `→ $${nextOfferDollars.toFixed(2)} (${nextDiscountPct.toFixed(2)}% off)`;
        const standLabel = `Stand`;
        const standSub = `min offer: $${toMoney(minOfferCents)}`;

        renderUI({ increaseLabel, increaseSub, standLabel, standSub, increaseAmount: nextOfferDollars, standAmount: minOfferCents / 100 });
    }

    if (!("chrome" in window) || !chrome.storage?.local) {
        console.warn("Bargain Helper: chrome.storage.local not available");
        return;
    }

    chrome.storage.local.get(null, (all: any) => {
        try {
            const steamID = all["floatpilot_user"]?.steamID64;
            if (!steamID) return;

            const settingsKey = `floatpilot_settings_${steamID}`;
            const settings = all[settingsKey];
            const enabled = settings?.bargainHelperio ?? settings?.bargainHelper;
            if (!enabled) return;

            const scheduleScan = () => {
                if (debounceTimer != null) return;
                debounceTimer = window.setTimeout(() => {
                    debounceTimer = null;
                    if (rafScheduled) return;
                    rafScheduled = true;
                    requestAnimationFrame(() => {
                        buildPreview();
                        rafScheduled = false;
                    });
                }, 50);
            };

            scheduleScan();
            new MutationObserver(() => scheduleScan()).observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true,
            });

            chrome.storage.onChanged?.addListener((changes, areaName) => {
                if (areaName !== 'local') return;
                if (changes[settingsKey]) {
                    const nowEnabled = (changes[settingsKey].newValue || {}).bargainHelperio
                        ?? (changes[settingsKey].newValue || {}).bargainHelper;
                    if (nowEnabled) scheduleScan();
                }
            });
        } catch (e) {
            console.error("Bargain Helper init error:", e);
        }
    });
})();
