console.log("✅ FloatPilot: Skinport content script loaded.");

interface BetterDealInfo {
    price: number;          // price in listing currency
    usdPrice: number;       // price in pure USD
    currency: string;       // listing currency code (EUR, USD…)
    float: number;
    link: string;
}

interface CSFloatListing {
    id: string;
    price: number;          // price in cents USD
    item: { float_value: number };
}

interface CSFloatResponse {
    success: boolean;
    data: CSFloatListing[];
}

let betterDealInfo: BetterDealInfo | null = null;
let addToCartButton: HTMLButtonElement | null = null;
let overlay: HTMLDivElement | null = null;

/* -------------------------------------------------------------
   0. Get API key helper (popup‑stored)
--------------------------------------------------------------*/
async function getApiKey(): Promise<string> {
    return new Promise((res) =>
        chrome.runtime.sendMessage({ type: 'getApiKey' }, (key) => res(key || ''))
    );
}

/* -------------------------------------------------------------
   1. Currency helpers
--------------------------------------------------------------*/
const symbolMap: Record<string, string> = {
    "€": "EUR",
    "$": "USD",
    "£": "GBP",
    "CHF": "CHF",
    "kr": "SEK",
    "zł": "PLN",
    "¥": "JPY",
    "R$": "BRL",
};

function resolveCurrency(explicit: string | undefined | null, priceTxt: string): string {
    const clean = explicit?.trim();
    if (clean && symbolMap[clean]) return symbolMap[clean];
    const hit = Object.entries(symbolMap).find(([sym]) => priceTxt.includes(sym));
    return hit ? hit[1] : "EUR";
}

/* -------------------------------------------------------------
   2. FX helper (cached, multi‑provider)
--------------------------------------------------------------*/
const fxCache: Record<string, number> = { USD: 1 };

async function fxRate(target: string): Promise<number> {
    target = (target || "").trim().toUpperCase();
    if (!target) return 1;
    if (fxCache[target]) return fxCache[target];
    if (target === "USD") return 1;

    const endpoints = [
        `https://api.exchangerate.host/latest?base=USD&symbols=${target}`,
        "https://open.er-api.com/v6/latest/USD",
        "https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/usd.json",
    ];

    for (const url of endpoints) {
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const j = await res.json();
            let rate: number | undefined;

            if ("rates" in j) {
                rate = j.rates[target] ?? j.rates[target.toLowerCase()];
            } else if ("usd" in j) {
                rate = j.usd[target.toLowerCase()];
            }

            if (typeof rate === "number" && isFinite(rate) && rate > 0) {
                fxCache[target] = rate;
                console.log(`[FloatPilot] FX USD→${target}:`, rate);
                return rate;
            }
        } catch { /* ignore */ }
    }

    console.warn(`[FloatPilot] FX fallback for ${target}, assuming 1`);
    return 1;
}

/* -------------------------------------------------------------
   3. Misc helpers
--------------------------------------------------------------*/
const wearCat = (f: number): string =>
    f <= 0.07 ? "Factory New" :
        f <= 0.15 ? "Minimal Wear" :
            f <= 0.38 ? "Field-Tested" :
                f <= 0.45 ? "Well-Worn" : "Battle-Scarred";

const round2 = (n: number): number => Math.round(n * 100) / 100;

function sendMessageSafe<T = unknown>(payload: Record<string, unknown>, cb: (resp: T) => void): void {
    const fn = chrome?.runtime?.sendMessage;
    if (typeof fn === "function") fn(payload, cb);
    else {
        console.warn("[FloatPilot] sendMessage unavailable (non‑extension context)");
        cb({ success: false } as unknown as T);
    }
}

/* -------------------------------------------------------------
   4. Main observer to detect navigation
--------------------------------------------------------------*/
let lastUrl = location.href;
new MutationObserver(() => {
    const cur = location.href;
    if (cur !== lastUrl) {
        lastUrl = cur;
        if (cur.includes("/item/")) void grabSkinportData();
    }
}).observe(document, { subtree: true, childList: true });

if (location.pathname.startsWith("/item/")) void grabSkinportData();

/* -------------------------------------------------------------
   5. Core logic per‑item page
--------------------------------------------------------------*/
async function grabSkinportData(): Promise<void> {
    const typeEl  = document.querySelector<HTMLDivElement>(".ItemPage-title");
    const nameEl  = document.querySelector<HTMLDivElement>(".ItemPage-name");
    const wearEl  = document.querySelector<HTMLDivElement>(".WearBar-value");
    const priceEl = document.querySelector<HTMLSpanElement>(".ItemPage-value .Tooltip-link");
    const curEl   = document.querySelector<HTMLSpanElement>(".ItemPage-currency");

    if (!(typeEl && nameEl && wearEl && priceEl)) {
        window.setTimeout(grabSkinportData, 100);
        return;
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
        console.warn('[FloatPilot] No API key set via popup – skipping lookup');
        return;
    }

    const itemType = typeEl.textContent?.trim() ?? "";
    const itemName = nameEl.textContent?.trim() ?? "";
    const float    = parseFloat(wearEl.textContent?.trim() ?? "0");

    const raw     = priceEl.textContent ?? "0";
    const spPrice = parseFloat(raw.replace(/[^0-9,.]/g, "").replace(/,/, ".")) || 0;

    const currency = resolveCurrency(curEl?.textContent, raw);
    const rate     = await fxRate(currency);

    const fullName = `${/(Gloves|Knife)/.test(itemType) ? "★ " : ""}${itemType} | ${itemName} (${wearCat(float)})`;
    console.log(`[FloatPilot] Item: ${fullName} / ${currency} ${spPrice} / Float ${float}`);

    sendMessageSafe<CSFloatResponse>(
        { type: 'searchCSFloat', itemName: fullName, maxFloat: float },
        (resp) => handleCSFloat(resp, spPrice, float, currency, rate)
    );

    addToCartButton = document.querySelector<HTMLButtonElement>(".SubmitButton.SubmitButton--isFull");
    addToCartButton?.addEventListener('click', (e) => {
        if (betterDealInfo) {
            e.preventDefault();
            showPopup(betterDealInfo);
            betterDealInfo = null;
        }
    });
}

function handleCSFloat(resp: CSFloatResponse, spPrice: number, spFloat: number, cur: string, rate: number): void {
    if (!resp?.success) {
        console.error('[FloatPilot] BG error', resp);
        return;
    }
    const list = resp.data ?? [];
    if (!list.length) return;

    list.sort((a, b) => a.price - b.price);
    for (const l of list) {
        const usd       = l.price / 100;
        const converted = cur === 'USD' ? usd : usd * rate;
        if (l.item.float_value <= spFloat * 1.01 && converted < spPrice) {
            betterDealInfo = {
                price: round2(converted),
                usdPrice: round2(usd),
                currency: cur,
                float: l.item.float_value,
                link: `https://csfloat.com/item/${l.id}`,
            };
            console.log('[FloatPilot] Better deal:', betterDealInfo);
            break;
        }
    }
}

function showPopup(info: BetterDealInfo): void {
    overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        background: 'rgba(0,0,0,0.5)',
        zIndex: '9998',
    });
    document.body.appendChild(overlay);

    const box = document.createElement('div');
    Object.assign(box.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) scale(0)', // start scaled down
        background: '#2f4f2f',
        color: '#fff',
        padding: '32px',
        borderRadius: '16px',
        boxShadow: '0 0 28px rgba(0,0,0,0.6)',
        textAlign: 'center',
        maxWidth: '500px',
        width: '90%',
        zIndex: '9999',
        transition: 'transform .35s ease-out',
    });

    box.innerHTML = `
    <div style="margin-bottom:16px;font-size:1.25rem;font-weight:bold;">💎 Better deal found!</div>
    <div style="margin-bottom:8px;font-size:1.1rem;">Price: ${info.currency} ${info.price} (USD $${info.usdPrice})</div>
    <div style="margin-bottom:16px;font-size:1.1rem;">Float: ${info.float.toFixed(5)}</div>
    <a href="${info.link}" target="_blank" style="display:inline-block;background:#00ffae;padding:12px 18px;color:#000;text-decoration:none;border-radius:10px;font-weight:bold;">View on CSFloat</a>
    <br/><br/>
    <button id="continuePurchaseBtn" style="background:transparent;border:2px solid #00ffae;padding:10px 18px;color:#00ffae;border-radius:10px;cursor:pointer;font-weight:bold;">Continue Purchase</button>
  `;

    document.body.appendChild(box);

    // animation
    requestAnimationFrame(() => {
        box.style.transform = 'translate(-50%, -50%) scale(1)';
    });

    document.getElementById('continuePurchaseBtn')?.addEventListener('click', () => {
        box.remove();
        overlay?.remove();
        addToCartButton?.click();
    });
}
