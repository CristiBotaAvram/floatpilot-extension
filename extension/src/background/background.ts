console.log('✅ FloatPilot background loaded');

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete') return;
    if (!tab.url?.includes('/item/')) return;

    chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content-scripts/itemContent.js'], // update if bundled differently
    }, () => {
        console.debug('[FloatPilot] Injected itemContent.js into /item page');
    });
});


const CACHE_TTL_MS = 8 * 60 * 60 * 1_000; // 8 hours
type SalesRow = { date: string; float: number; price: number };

// ────────────────────── Cache & Queue ──────────────────────
const scrapeQueue: { hashName: string; url: string }[] = [];
let scrapeActive = false;

function enqueueScrape(hashName: string, url: string) {
    scrapeQueue.push({ hashName, url });
    console.debug(`[FloatPilot] Queued scrape for: ${hashName} | Queue size: ${scrapeQueue.length}`);
    if (!scrapeActive) processNextScrape();
}

function processNextScrape() {
    if (!scrapeQueue.length) {
        scrapeActive = false;
        return;
    }

    scrapeActive = true;
    const { hashName, url } = scrapeQueue.shift()!;
    console.debug(`[FloatPilot] Starting scrape for: ${hashName} → ${url}`);

    chrome.tabs.create({ url, active: false }, (tab) => {
        if (!tab?.id) {
            console.warn(`[FloatPilot] Failed to open tab for ${hashName}`);
            return processNextScrape();
        }

        const tabId = tab.id;

        scrapeViaPopup(url)
            .then((rows) => cacheSales(hashName, rows))
            .catch((err) => console.warn(`[FloatPilot] Scrape failed for ${hashName}:`, err.message))
            .finally(() => {
                chrome.tabs.remove(tabId);
                console.debug(`[FloatPilot] Finished scrape for: ${hashName} | Queue left: ${scrapeQueue.length}`);
                setTimeout(processNextScrape, 500); // small gap
            });
    });
}

// ────────────────────── Sales Scraper ──────────────────────
async function scrapeViaPopup(listingUrl: string): Promise<SalesRow[]> {
    return new Promise((resolve, reject) => {
        chrome.windows.create(
            {
                url: listingUrl,
                type: 'popup',
                state: 'minimized',
                width: 900,
                height: 700,
                focused: false,
            },
            (win) => {
                if (!win?.tabs?.[0]?.id || !win.id) return reject(new Error('popup_failed'));
                const tabId = win.tabs[0].id;

                chrome.scripting.executeScript(
                    {
                        target: { tabId },
                        func: () => {
                            console.debug('[FloatPilot] Popup script injected');
                            return new Promise<SalesRow[]>((res) => {
                                setTimeout(() => {
                                    const clickTab = Array.from(document.querySelectorAll('[role="tab"], button, a')).find((el) =>
                                        /latest\s+sales/i.test(el.textContent || '')
                                    ) as HTMLElement | undefined;
                                    clickTab?.click();

                                    const int = setInterval(() => {
                                        const rowsEls = document.querySelectorAll('table tbody tr');
                                        if (rowsEls.length) {
                                            clearInterval(int);
                                            const rows = Array.from(rowsEls).map((tr) => {
                                                const tds = tr.querySelectorAll('td');
                                                return {
                                                    date: tds[0]?.textContent?.trim() ?? '',
                                                    float: parseFloat(tds[1]?.textContent ?? '0'),
                                                    price: parseFloat((tds[2]?.textContent ?? '').replace(/[^0-9.]/g, '')),
                                                };
                                            });
                                            console.debug('[FloatPilot] Popup extracted', rows.length, 'rows');
                                            res(rows);
                                        }
                                    }, 300);
                                }, 1000); // let Angular render
                            });
                        },
                    },
                    (injectedResult) => {
                        chrome.windows.remove(win.id!);
                        const rows = injectedResult?.[0]?.result as SalesRow[] | undefined;
                        if (rows && rows.length) resolve(rows);
                        else reject(new Error('popup_no_rows'));
                    },
                );
            },
        );
    });
}

// ────────────────────── Storage ──────────────────────
async function cacheSales(hashName: string, rows: SalesRow[]): Promise<void> {
    const key = `sales_cache_${encodeURIComponent(hashName)}`;
    const now = Date.now();
    await chrome.storage.local.set({
        [key]: { rows, expiresAt: now + CACHE_TTL_MS },
    });
    console.debug(`[FloatPilot] Cached ${rows.length} rows for "${hashName}"`);
}

// ────────────────────── Message Handling ──────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'OPEN_LISTING_TAB') {
        enqueueScrape(msg.hashName, msg.url);
        sendResponse({ success: true });
        return true;
    }
});
