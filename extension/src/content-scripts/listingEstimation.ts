(() => {
    const listingDataCache: Record<number, any> = {};

    window.addEventListener("message", (event) => {
        if (event.source !== window || !event.data?.type || event.data.type !== "CSFLOAT_LISTINGS") return;
        const listings = event.data.payload;
        if (Array.isArray(listings)) {
            listings.forEach((entry: any) => {
                const float = entry.item?.float_value;
                if (typeof float === "number") {
                    listingDataCache[float] = entry;
                }
            });
            //console.log("[INJECTED FETCH] Cached listings:", listingDataCache);
        }
    });

    const findItemByFloat = (float: number): any | null => {
        const tolerance = 0.000000001;
        for (const cachedFloatStr in listingDataCache) {
            const cachedFloat = parseFloat(cachedFloatStr);
            if (Math.abs(cachedFloat - float) < tolerance) {
                return listingDataCache[cachedFloatStr];
            }
        }
        return null;
    };

    const attachDataToCard = (card: HTMLElement) => {
        if (card.hasAttribute("data-csfloat-data")) return;
        const wearText = card.querySelector(".wear, .float")?.textContent?.trim();
        const cardFloat = wearText ? parseFloat(wearText) : NaN;
        if (isNaN(cardFloat)) return;

        const item = findItemByFloat(cardFloat);
        if (!item) return;

        try {
            const data = { ...item };
            card.dataset.csfloatData = JSON.stringify(data);
            //console.log(`[DATA ATTACHED TO CARD] Float: ${cardFloat}`, data);
        } catch (err) {
            console.warn("Failed to attach listing data to card:", err);
        }
    };

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
        const apiKey = all["floatpilot_user"]?.apiKey;
        const selectedConfig = settings?.selectedConfig;
        const enabled = settings?.itemEstimation;

        if (!enabled || !selectedConfig) {
            htmlCard.dataset.estimationStatus = "skipped";
            return;
        }

        const configId: string = selectedConfig.id;
        if (!configId) {
            htmlCard.dataset.estimationStatus = "invalid";
            return;
        }

        const item = {
            float_value: itemData.item.float_value,
            fade_percent: itemData.item.fade?.percentage,
            playside_blue: itemData.item.blue_gem?.playside_blue,
            stickers: JSON.stringify(itemData.item.stickers || [])
        };

        if (itemData.item.phase) {
            itemData.item.market_hash_name = `${itemData.item.market_hash_name} | ${itemData.item.phase}`;
        }

        try {
            const batchPayload = [
                {
                    configId: configId,
                    item: {
                        ...item,
                        market_hash_name: itemData.item.market_hash_name
                    }
                }
            ];

            const estimationRes = await fetch("https://www.floatpilot.store/api/estimation", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey
                },
                body: JSON.stringify({ listingsArray: batchPayload })
            });

            const result = await estimationRes.json();
            const estimatedPrice = result?.prices?.[0] / 100;

            if (estimatedPrice) {
                let targetEl = htmlCard.querySelector(".price");
                if (htmlCard.classList.contains("header")) {
                    targetEl = htmlCard.querySelector(".details .container");
                }

                if (targetEl) {
                    const estimateText = `~$${estimatedPrice.toFixed(2)}`;
                    let tag = targetEl.querySelector(".estimation-tag") as HTMLElement;
                    if (!tag) {
                        tag = document.createElement("div");
                        tag.className = "estimation-tag";
                        tag.style.color = "#64EC42";
                        tag.style.fontWeight = "normal";
                        tag.style.fontSize = htmlCard.classList.contains("header") ? "1.5em" : "0.9em";
                        tag.textContent = estimateText;
                        targetEl.appendChild(tag);
                    } else if (tag.textContent !== estimateText) {
                        tag.textContent = estimateText;
                    }
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
        document.querySelectorAll("item-card, .header").forEach((card) => {
            const htmlCard = card as HTMLElement;
            attachDataToCard(htmlCard);

            const status = htmlCard.dataset.estimationStatus;
            if (!status || status === "waiting") {
                estimateCard(htmlCard);
            }
        });
    };

    const observeHeaderChanges = () => {
        if (!location.href.includes("/profile/offers")) return;

        const waitForHeaders = () => {
            const headers = Array.from(document.querySelectorAll(".header"))
                .filter(h => h.querySelector(".item") || h.querySelector(".details"));

            if (headers.length === 0) {
                requestAnimationFrame(waitForHeaders);
                return;
            }

            headers.forEach((header) => {
                const observer = new MutationObserver(() => {
                    const htmlHeader = header as HTMLElement;
                    htmlHeader.dataset.estimationStatus = "";

                    const float = parseFloat(header.querySelector(".float")?.textContent || "");
                    if (!isNaN(float)) {
                        const item = findItemByFloat(float);
                        if (item) {
                            const currentData = htmlHeader.dataset.csfloatData;
                            const newData = JSON.stringify({ ...item });
                            if (currentData !== newData) {
                                htmlHeader.dataset.csfloatData = newData;
                                //console.log(`[HEADER UPDATE] data-csfloat-data refreshed for float: ${float}`);
                            }
                        }
                    }
                });

                observer.observe(header, { childList: true, subtree: true, characterData: true });
            });
        };

        waitForHeaders();
    };

    setInterval(checkCards, 500);

    const observer = new MutationObserver(checkCards);
    observer.observe(document.body, { childList: true, subtree: true });

    setInterval(observeHeaderChanges, 1000);
})();
