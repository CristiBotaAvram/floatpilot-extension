
(() => {
const decryptConfigCode = async (encryptedCode: string, configId: string): Promise<string | null> => {
    const cacheKey = `decrypted_config_${configId}`;
    const cached = await new Promise<string | null>((resolve) => {
        chrome.storage.local.get(cacheKey, (result) => resolve(result[cacheKey] || null));
    });
    if (cached) return cached;

    try {
        const res = await fetch("https://www.floatpilot.store/api/decrypt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ encrypted: encryptedCode })
        });

        const json = await res.json();
        const decrypted = json.payload || json.code;
        if (!res.ok || !decrypted) throw new Error(json?.error || "Missing payload");

        await new Promise<void>((resolve) => {
            chrome.storage.local.set({ [cacheKey]: decrypted }, () => resolve());
        });

        return decrypted;
    } catch (err) {
        console.error("Decrypt failed:", err);
        return null;
    }
};

const listingDataCache: Record<string, any> = {};
const salesQueue: Record<string, Promise<any[] | null>> = {};

interface CSFloatListingEntry {
    id: string;
    item?: {
        float_value: number;
        fade_percent?: number | null;
        playside_blue?: number | null;
        stickers?: any[] | null;
        market_hash_name: string;
    };
}

window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data?.type || event.data.type !== "CSFLOAT_LISTINGS") return;
    const listings = event.data.payload;
    if (Array.isArray(listings)) {
        listings.forEach((entry: CSFloatListingEntry) => {
            const float = entry.item?.float_value;
            if (typeof float === "number") {
                listingDataCache[float] = entry.item;
            }
        });
        console.log("[INJECTED FETCH] Cached listings:", listingDataCache);
    }
});

const getCachedSales = async (marketName: string): Promise<any[] | null> => {
    if (await salesQueue[marketName]) return salesQueue[marketName];

    const task = new Promise<any[] | null>(async (resolve) => {
        const cacheKey = `sales_cache_${marketName}`;
        const timestampKey = `${cacheKey}_timestamp`;
        const now = Date.now();

        const { [cacheKey]: cachedSales, [timestampKey]: cachedTime } = await new Promise<any>((resolve) => {
            chrome.storage.local.get([cacheKey, timestampKey], (result) => resolve(result));
        });

        if (cachedSales && cachedTime && now - cachedTime < 60 * 60 * 1000) {
            resolve(cachedSales);
            delete salesQueue[marketName];
            return;
        }

        try {
            const salesRes = await fetch(`https://www.floatpilot.store/api/sales?name=${encodeURIComponent(marketName)}`);
            const sales = await salesRes.json();

            await new Promise<void>((res) => {
                chrome.storage.local.set({
                    [cacheKey]: sales,
                    [timestampKey]: now
                }, () => res());
            });

            resolve(sales);
        } catch (err) {
            console.error("Failed to fetch or cache sales:", err);
            resolve(null);
        } finally {
            delete salesQueue[marketName];
        }
    });

    salesQueue[marketName] = task;
    return task;
};

const observer = new MutationObserver(() => {
    document.querySelectorAll("item-card").forEach(async (card) => {
        if ((card as HTMLElement).dataset.estimated) return;

        chrome.storage.local.get(null, async (all) => {
            const steamID = all["floatpilot_user"]?.steamID64;
            const settings = all[`floatpilot_settings_${steamID}`];
            const selectedConfig = settings?.selectedConfig;
            const enabled = settings?.itemEstimation;

            if (!enabled || !selectedConfig) return;

            const encryptedCode = selectedConfig.encrypted_code;
            const configId = selectedConfig.id;
            if (!encryptedCode || !configId) return;

            const decryptedCode = await decryptConfigCode(encryptedCode, configId);
            if (!decryptedCode) return;

            const dataAttr = card.getAttribute("data-csfloat-data");
            const itemData = dataAttr ? JSON.parse(dataAttr) : null;

            if (!itemData) return;

            const item = {
                float_value: itemData.item.float_value,
                fade_percent: itemData.item.fade_percent,
                playside_blue: itemData.item.playside_blue,
                stickers: JSON.stringify(itemData.item.stickers || [])
            };
            if (itemData.item.phase) {
                itemData.item.market_hash_name = `${itemData.item.market_hash_name} | ${itemData.item.phase}`;
            }

            try {
                const sales = await getCachedSales(itemData.item.market_hash_name);
                if (!sales) return;

                const batchPayload = [
                    {
                        code: decryptedCode,
                        item,
                        listings: sales
                    }
                ];

                const estimationRes = await fetch("https://www.floatpilot.store/api/estimation", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ listingsArray: batchPayload })
                });

                const result = await estimationRes.json();
                const estimatedPrice = result?.prices?.[0] / 100;

                if (estimatedPrice) {
                    const priceEl = card.querySelector(".price");
                    if (priceEl && !priceEl.querySelector(".estimation-tag")) {
                        const tag = document.createElement("div");
                        tag.className = "estimation-tag";
                        tag.textContent = `~$${estimatedPrice.toFixed(2)}`;
                        tag.style.color = "#64EC42";
                        tag.style.fontWeight = "normal";
                        tag.style.fontSize = "0.9em";
                        priceEl.appendChild(tag);
                    }
                }
            } catch (err) {
                console.error("Estimation error:", err);
            }

            (card as HTMLElement).dataset.estimated = "true";
        });
    });
});

observer.observe(document.body, { childList: true, subtree: true });
})();