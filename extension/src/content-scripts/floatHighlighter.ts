(() => {
    const addHighlight = async (htmlCard: HTMLElement) => {
        const floatEl = htmlCard.querySelector(".wear");
        if (floatEl) {
            const floatText = floatEl.textContent?.trim();
            const floatValue = parseFloat(floatText || "");
            if (!isNaN(floatValue)) {
                const badHighlight =
                    (floatValue <= 1 && floatValue >= 0.95) ||
                    (floatValue <= 0.45 && floatValue >= 0.44) ||
                    (floatValue <= 0.38 && floatValue >= 0.35) ||
                    (floatValue <= 0.15 && floatValue >= 0.14) ||
                    (floatValue <= 0.07 && floatValue >= 0.06);

                if (badHighlight) {
                    floatEl.setAttribute("style", "color: #ff2b2b;");
                    return;
                }

                const goodHighlight =
                    (floatValue <= 0.50 && floatValue >= 0.46) ||
                    (floatValue <= 0.39 && floatValue >= 0.38) ||
                    (floatValue <= 0.18 && floatValue >= 0.16) ||
                    (floatValue <= 0.08 && floatValue >= 0.07) ||
                    (floatValue <= 0.01 && floatValue >= 0.001);

                if (goodHighlight) {
                    floatEl.setAttribute("style", "color: #00ffec;");
                    return;
                }

                const veryGoodHighlight =
                    (floatValue <= 0.46 && floatValue >= 0.45) ||
                    (floatValue <= 0.16 && floatValue >= 0.15) ||
                    (floatValue <= 0.001 && floatValue >= 0);

                if (veryGoodHighlight) {
                    floatEl.setAttribute("style", "color: #17ff00;");
                    return;
                }
            }
        }
    };

    const addHighlightToSalesTable = () => {
        const isChecked = document.getElementById("mat-button-toggle-27-button")?.getAttribute("aria-checked") === "true";
        if (!isChecked) return;

        const floatCells = document.querySelectorAll('[data-column-name="Float Value"] span');
        floatCells.forEach((span) => {
            const floatText = span.textContent?.trim();
            const floatValue = parseFloat(floatText || "");

            if (!isNaN(floatValue)) {
                const bad =
                    (floatValue <= 1 && floatValue >= 0.95) ||
                    (floatValue <= 0.45 && floatValue >= 0.44) ||
                    (floatValue <= 0.38 && floatValue >= 0.35) ||
                    (floatValue <= 0.15 && floatValue >= 0.14) ||
                    (floatValue <= 0.07 && floatValue >= 0.06);

                const good =
                    (floatValue <= 0.50 && floatValue >= 0.46) ||
                    (floatValue <= 0.39 && floatValue >= 0.38) ||
                    (floatValue <= 0.18 && floatValue >= 0.16) ||
                    (floatValue <= 0.08 && floatValue >= 0.07) ||
                    (floatValue <= 0.01 && floatValue >= 0.001);

                const veryGood =
                    (floatValue <= 0.46 && floatValue >= 0.45) ||
                    (floatValue <= 0.16 && floatValue >= 0.15) ||
                    (floatValue <= 0.001 && floatValue >= 0);

                if (bad) span.setAttribute("style", "color: #ff2b2b;");
                else if (good) span.setAttribute("style", "color: #00ffec;");
                else if (veryGood) span.setAttribute("style", "color: #17ff00;");
            }
        });
    };

    chrome.storage.local.get(null, (all: any) => {
        const steamID = all["floatpilot_user"]?.steamID64;
        if (!steamID) return;
        const settings = all[`floatpilot_settings_${steamID}`];
        if (!settings?.floatHighlight) return;

        const scan = () => {
            document.querySelectorAll('item-card').forEach(el => addHighlight(el as HTMLElement));
            addHighlightToSalesTable();
        };

        scan();
        new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
    });
})();
