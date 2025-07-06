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

    const listingDataCache: Record<number, any> = {};

    window.addEventListener("message", (event) => {
        if (event.source !== window || !event.data?.type || event.data.type !== "CSFLOAT_LISTINGS") return;
        const listings = event.data.payload;
        if (Array.isArray(listings)) {
            listings.forEach((entry: any) => {
                const float = entry.item?.float_value;
                if (typeof float === "number") {
                    listingDataCache[float] = entry.item;
                }
            });
            console.log("[INJECTED FETCH] Cached listings:", listingDataCache);
        }
    });

    const estimateCard = async (htmlCard: HTMLElement) => {
        htmlCard.dataset.estimationStatus = "processing";

        const dataAttr = htmlCard.getAttribute("data-csfloat-data");
        const itemData = dataAttr ? JSON.parse(dataAttr) : null;
        if (!itemData) {
            htmlCard.dataset.estimationStatus = "waiting";
            return;
        }

        const all = await new Promise<any>((resolve) => chrome.storage.local.get(null, resolve));
        const steamID = all["floatpilot_user"]?.steamID64;
        const settings = all[`floatpilot_settings_${steamID}`];
        const selectedConfig = settings?.selectedConfig;
        const enabled = settings?.itemEstimation;

        if (!enabled || !selectedConfig) {
            htmlCard.dataset.estimationStatus = "skipped";
            return;
        }

        const encryptedCode: string = selectedConfig.encrypted_code;
        const configId: string = selectedConfig.id;
        if (!encryptedCode || !configId) {
            htmlCard.dataset.estimationStatus = "invalid";
            return;
        }

        const decryptedCode = await decryptConfigCode(encryptedCode, configId);
        if (!decryptedCode) {
            htmlCard.dataset.estimationStatus = "failed_decrypt";
            return;
        }

        const item = {
            float_value: itemData.item.float_value,
            fade_percent: itemData.item.fade_percent,
            playside_blue: itemData.item.blue_gem.playside_blue,
            stickers: JSON.stringify(itemData.item.stickers || [])
        };

        if (itemData.item.phase) {
            itemData.item.market_hash_name = `${itemData.item.market_hash_name} | ${itemData.item.phase}`;
        }

        try {
            const batchPayload = [
                {
                    code: decryptedCode,
                    item: {
                        ...item,
                        market_hash_name: itemData.item.market_hash_name
                    }
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
                const priceEl = htmlCard.querySelector(".price");
                if (priceEl && !priceEl.querySelector(".estimation-tag")) {
                    const tag = document.createElement("div");
                    tag.className = "estimation-tag";
                    tag.textContent = `~$${estimatedPrice.toFixed(2)}`;
                    tag.style.color = "#64EC42";
                    tag.style.fontWeight = "normal";
                    tag.style.fontSize = "0.9em";
                    priceEl.appendChild(tag);
                }
                htmlCard.dataset.estimationStatus = "done";
            } else {
                htmlCard.dataset.estimationStatus = "no_result";
            }
        } catch (err) {
            console.error("Estimation error:", err);
            htmlCard.dataset.estimationStatus = "failed";
        }
    };

    const checkCards = () => {
        document.querySelectorAll("item-card").forEach((card) => {
            const htmlCard = card as HTMLElement;
            const status = htmlCard.dataset.estimationStatus;

            if (!status || status === "waiting") {
                estimateCard(htmlCard);
            }
        });
    };

    setInterval(checkCards, 500);

    const observer = new MutationObserver(checkCards);
    observer.observe(document.body, { childList: true, subtree: true });
})();
