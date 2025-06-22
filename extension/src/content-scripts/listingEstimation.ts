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

const observer = new MutationObserver(() => {
    document.querySelectorAll("item-card").forEach(async (card) => {
        if ((card as HTMLElement).dataset.estimated) return;

        const nameEl = card.querySelector(".item-name")?.textContent?.trim();
        const wearEl = card.querySelector(".wear")?.textContent?.trim();
        const floatValue = parseFloat(wearEl ?? "");

        if (!nameEl || isNaN(floatValue)) return;

        const condition = card.querySelector(".subtext")?.textContent?.split("(")[0]?.trim();
        const phaseMatch = card.querySelector(".subtext")?.textContent?.match(/\((.*?)\)/);
        const phase = phaseMatch ? ` (${phaseMatch[1]})` : "";
        const fullName = `${nameEl} (${condition})${phase}`.trim();

        chrome.storage.local.get(null, async (all) => {
            const steamID = all["floatpilot_user"]?.steamID64;
            if (!steamID) return;

            const settings = all[`floatpilot_settings_${steamID}`];
            const selectedConfig = settings?.selectedConfig;
            const encryptedCode = selectedConfig?.encrypted_code;
            const configId = selectedConfig?.id;

            if (!encryptedCode || !configId) return;

            const decryptedCode = await decryptConfigCode(encryptedCode, configId);
            if (!decryptedCode) return;

            const item = { float_value: floatValue };

            try {
                const batchPayload = [
                    {
                        code: decryptedCode,
                        item,
                        listings: [] // Placeholder, will be replaced by fetched sales data
                    }
                ];

                const salesRes = await fetch(`https://www.floatpilot.store/api/sales?name=${encodeURIComponent(fullName)}`);
                const sales = await salesRes.json();
                batchPayload[0].listings = sales;

                const estimationRes = await fetch("https://www.floatpilot.store/api/estimation", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ listingsArray: batchPayload })
                });

                const result = await estimationRes.json();
                const estimatedPrice = result?.prices?.[0];

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
                console.error("Batch estimation failed:", err);
            }

            (card as HTMLElement).dataset.estimated = "true";
        });
    });
});

observer.observe(document.body, { childList: true, subtree: true });
