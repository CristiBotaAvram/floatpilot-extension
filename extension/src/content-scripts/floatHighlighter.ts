(() => {
    const highlightFloatValue = (el: HTMLElement, floatValue: number) => {
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

        if (bad) el.setAttribute("style", "color: #ff2b2b;");
        else if (good) el.setAttribute("style", "color: #00ffec;");
        else if (veryGood) el.setAttribute("style", "color: #17ff00;");
    };

    const addHighlight = async (htmlCard: HTMLElement) => {
        const floatEl = htmlCard.querySelector(".wear") as HTMLElement | null;;
        if (floatEl) {
            const floatText = floatEl.textContent?.trim();
            const floatValue = parseFloat(floatText || "");
            if (!isNaN(floatValue)) {
                highlightFloatValue(floatEl, floatValue);
            }
        }
    };

    const highlightAllMatchingText = () => {
        const allTextNodes = document.querySelectorAll('span');
        allTextNodes.forEach((span) => {
            const text = span.textContent?.trim() || "";
            const match = text.match(/^0\.[0-9]{12}$/);
            if (match) {
                const floatValue = parseFloat(text);
                if (!isNaN(floatValue)) {
                    highlightFloatValue(span, floatValue);
                }
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
            document.querySelectorAll('td.mat-column-wear').forEach(() => highlightAllMatchingText());
        };

        scan();
        new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
    });
})();
