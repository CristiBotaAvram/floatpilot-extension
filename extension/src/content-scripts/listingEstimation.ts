const get = <T = unknown>(key: string): Promise<T | undefined> => {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key]);
        });
    });
};

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

        const config = await get<Record<string, unknown>>("selectedConfig");
        console.log("Loaded config from storage:", config);
        const encryptedCode = typeof config?.encrypted_code === "string" ? config.encrypted_code : undefined;
        if (!encryptedCode) {
            console.log("No config or code found.", config);
            return;
        }

        let decryptedCode: string;
        try {
            const decryptRes = await fetch("https://floatpilot.store/api/decrypt", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ encrypted: encryptedCode })
            });
            const data = await decryptRes.json();
            decryptedCode = data.code;
            console.log("Decrypted code:", decryptedCode.slice(0, 100), "...");
        } catch (err) {
            console.error("Failed to fetch/decrypt config code:", err);
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

observer.observe(document.body, { childList: true, subtree: true });
