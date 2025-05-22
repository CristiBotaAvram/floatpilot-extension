// itemContent.ts – FloatPilot content script for https://csfloat.com/item/*
// Scrapes sales data and prints valuation once per /item/... page

declare global {
    interface Window {
        __floatpilotItemActive?: boolean;
    }
}

if (window.__floatpilotItemActive) {
    console.debug('[FloatPilot] itemContent already running – skipping reinject');
} else {
    window.__floatpilotItemActive = true;
    initFloatPilot();
}

function initFloatPilot(): void {
    console.log('%c[FloatPilot] itemContent loaded', 'color:#0af');

    interface SaleRow {
        price: number;
        float: number;
        date: string;
    }

    let lastItemPath = '';

    function runScraper(): void {
        openLatestSalesTab();
        waitForSalesTable().then(summarize);
    }

    function openLatestSalesTab(): void {
        const tab = Array.from(document.querySelectorAll('[role="tab"], button, a')).find((el) =>
            /latest\s+sales/i.test(el.textContent || '')
        ) as HTMLElement | undefined;

        if (tab) {
            tab.click();
            console.debug('[FloatPilot] Clicked Latest Sales tab');
        } else {
            console.warn('[FloatPilot] Could not find Latest Sales tab');
        }
    }

    function waitForSalesTable(): Promise<SaleRow[]> {
        return new Promise((resolve) => {
            const interval = setInterval(() => {
                const rows = document.querySelectorAll('table tbody tr');
                if (!rows.length) return;

                clearInterval(interval);
                const parsed: SaleRow[] = Array.from(rows)
                    .map((tr) => {
                        const tds = tr.querySelectorAll('td');
                        return {
                            date: tds[0]?.textContent?.trim() || '',
                            float: parseFloat(tds[1]?.textContent || 'NaN'),
                            price: parseFloat((tds[2]?.textContent || '').replace(/[^0-9.]/g, 'NaN')),
                        };
                    })
                    .filter((r) => !isNaN(r.float) && !isNaN(r.price));
                resolve(parsed);
            }, 300);
        });
    }

    function summarize(rows: SaleRow[]): void {
        if (!rows.length) {
            console.warn('[FloatPilot] No usable sales rows – skipping summary');
            return;
        }

        const floats = rows.map((r) => r.float);
        const prices = rows.map((r) => r.price).sort((a, b) => a - b);

        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        const median = (arr: number[]) =>
            arr.length % 2 === 0
                ? (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2
                : arr[Math.floor(arr.length / 2)];

        const summary = {
            rows: rows.length,
            avgPrice: avg(prices).toFixed(2),
            medPrice: median(prices).toFixed(2),
            min: prices[0].toFixed(2),
            max: prices.at(-1)!.toFixed(2),
            avgFloat: avg(floats).toFixed(5),
        };

        console.log(
            `%c[FloatPilot] Sales Summary (${summary.rows} rows)\n` +
            `Price → avg $${summary.avgPrice} | median $${summary.medPrice} | range $${summary.min}–$${summary.max}\n` +
            `Float → avg ${summary.avgFloat}`,
            'color:#ffc107;font-weight:bold'
        );
    }

    // SPA route change watcher
    setInterval(() => {
        const currentPath = location.pathname;
        if (currentPath !== lastItemPath && currentPath.startsWith('/item/')) {
            lastItemPath = currentPath;
            console.debug('[FloatPilot] Navigated to', currentPath);
            setTimeout(runScraper, 1500);
        }
    }, 500);
}

