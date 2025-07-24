(() => {
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
