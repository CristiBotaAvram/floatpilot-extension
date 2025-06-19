const observer = new MutationObserver(() => {
    document.querySelectorAll("item-card").forEach(async (card) => {
        if ((card as HTMLElement).dataset.estimated) return; // skip if already processed

        const nameEl = card.querySelector(".item-name")?.textContent?.trim();
        const wearEl = card.querySelector(".wear")?.textContent?.trim();
        const floatValue = parseFloat(wearEl ?? "");

        console.log("Processing card:", { nameEl, wearEl, floatValue });

        if (!nameEl || isNaN(floatValue)) return;

        const condition = card.querySelector(".subtext")?.textContent?.split("(")[0]?.trim();
        const phaseMatch = card.querySelector(".subtext")?.textContent?.match(/\((.*?)\)/);
        const phase = phaseMatch ? ` (${phaseMatch[1]})` : "";
        const fullName = `${nameEl} ${condition}${phase}`.trim();

        console.log("Full item name:", fullName);

        chrome.storage.local.get(null, async (all) => {
            console.log("Full chrome.storage.local:", all);

            const decryptedCode = all.decryptedEstimationCode;
            if (!decryptedCode) {
                console.log("No decrypted code found");
                return;
            }

            let estimationFn: (listings: unknown[], item: Record<string, unknown>) => number | null;
            try {
                estimationFn = new Function("listings", "item", decryptedCode) as (listings: unknown[], item: Record<string, unknown>) => number | null;
            } catch (err) {
                console.error("Failed to compile estimation function:", err);
                return;
            }

            try {
                const response = await fetch(`https://floatpilot.store/api/sales?name=${encodeURIComponent(fullName)}`);
                const sales = await response.json();

                console.log("Fetched sales:", sales);

                const estimatedPrice = estimationFn(sales, { float_value: floatValue });

                console.log("Estimated price:", estimatedPrice);

                if (estimatedPrice) {
                    const priceEl = card.querySelector(".price");
                    if (priceEl) {
                        const tag = document.createElement("div");
                        tag.textContent = `Est. $${estimatedPrice.toFixed(2)}`;
                        tag.style.color = "#64EC42";
                        tag.style.fontWeight = "bold";
                        tag.style.fontSize = "0.9em";
                        priceEl.appendChild(tag);
                    }
                }
            } catch (err) {
                console.error("Estimation failed:", err);
            }

            (card as HTMLElement).dataset.estimated = "true";
        });
    });
});

observer.observe(document.body, { childList: true, subtree: true });
