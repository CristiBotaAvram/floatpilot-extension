console.log('%cFloatPilot searchContent injected', 'color:#00ff00;font-weight:bold');

/*────────────────────── Config ────────────────────*/
const CARD_SEL = 'item-card';
const NAME_SEL = '.item-name';
const processed = new Set<string>();

/*────────────────────── Types ─────────────────────*/
interface ItemCardData {
    name: string;
    float?: number;
    paintSeed?: number;
    exterior?: string;
    phase?: string;
    statTrak?: boolean;
    price?: number;
}

/*────────────────────── Extract + trigger ─────────*/
function handleCard(el: Element): void {
    const nameEl = el.querySelector<HTMLElement>(NAME_SEL);
    if (!nameEl) return;

    const name = nameEl.textContent?.trim();
    if (!name || processed.has(name)) return;
    processed.add(name);

    const float = parseFloat(el.querySelector('.wear')?.textContent || '');
    const paintSeed = parseInt(el.querySelector('.paint-seed')?.textContent || '');
    const priceRaw = el.querySelector('.price-row .price')?.textContent || '';
    const price = parseFloat(priceRaw.replace(/[^0-9.]/g, ''));

    const subtext = el.querySelector('.subtext')?.textContent || '';
    const statTrak = /StatTrak/i.test(subtext);
    const phaseMatch = subtext.match(/\(Phase\s?\d+\)/i);
    const phase = phaseMatch?.[0].replace(/[()]/g, '').trim();
    const exteriors = ['Factory New', 'Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred'];
    const exterior = exteriors.find(ext => subtext.includes(ext));

    const itemData: ItemCardData = {
        name,
        float: isNaN(float) ? undefined : float,
        paintSeed: isNaN(paintSeed) ? undefined : paintSeed,
        exterior,
        phase,
        statTrak,
        price: isNaN(price) ? undefined : price,
    };

    console.info('[FloatPilot] Detected item-card:', itemData);

    const routerPath =
        el.getAttribute('routerlink') || el.getAttribute('ng-reflect-router-link') || '';

    if (!routerPath.includes('/item/')) {
        console.debug('[FloatPilot] No usable listing URL in item-card:', name);
        return;
    }

    const listingUrl = `https://csfloat.com${routerPath}`;

    chrome.runtime.sendMessage(
        { type: 'OPEN_LISTING_TAB', hashName: name, url: listingUrl },
        (response) => {
            if (!response?.success) {
                console.warn(`[FloatPilot] Failed to open tab for ${name}:`, response?.error);
            } else {
                console.debug(`[FloatPilot] Queued direct scrape for: ${name}`);
            }
        }
    );
}

/*────────────────────── DOM Scanner ───────────────*/
function scan(node: Node): void {
    if (node instanceof Element && node.matches(CARD_SEL)) {
        handleCard(node);
        return;
    }

    if (node instanceof Element || node instanceof DocumentFragment) {
        const cards = node.querySelectorAll(CARD_SEL);
        console.debug(`[FloatPilot] scan found ${cards.length} <item-card> elements`);
        cards.forEach(handleCard);
    }
}

/*────────────────────── Init logic ────────────────*/
console.debug('[FloatPilot] Starting initial item-card scan');
scan(document);

const observer = new MutationObserver((muts) => {
    let total = 0;
    muts.forEach((m) => {
        m.addedNodes.forEach((n) => {
            scan(n);
            total++;
        });
    });
    if (total) console.debug(`[FloatPilot] MutationObserver saw ${total} new nodes`);
});
observer.observe(document.body, { childList: true, subtree: true });
console.debug('[FloatPilot] MutationObserver attached');
