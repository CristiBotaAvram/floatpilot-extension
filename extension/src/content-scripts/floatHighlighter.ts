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

        if (bad) el.style.color = "#ff2b2b";
        else if (good) el.style.color = "#00ffec";
        else if (veryGood) el.style.color = "#17ff00";
        else el.style.color = ""; // reset if it no longer matches any category
    };

    const addHighlight = async (htmlCard: HTMLElement) => {
        const floatEl = htmlCard.querySelector(".wear") as HTMLElement | null;
        if (floatEl) {
            const floatText = floatEl.textContent?.trim();
            const floatValue = parseFloat(floatText || "");
            if (!isNaN(floatValue)) {
                highlightFloatValue(floatEl, floatValue);
            } else {
                floatEl.style.color = "";
            }
        }
    };

    const highlightAllMatchingText = () => {
        document.querySelectorAll('td.mat-column-wear').forEach((cell) => {
            const target = (cell.querySelector('span') as HTMLElement) || (cell as HTMLElement);
            const text = target.textContent?.trim() || "";
            const match = text.match(/^(0\.[0-9]{6,12})/);
            if (match) {
                const floatValue = parseFloat(match[1]);
                if (!isNaN(floatValue)) {
                    highlightFloatValue(target, floatValue);
                } else {
                    target.style.color = "";
                }
            } else {
                target.style.color = "";
            }
        });

        document.querySelectorAll('span').forEach((span) => {
            const text = span.textContent?.trim() || "";
            const match = text.match(/^0\.[0-9]{6,12}$/);
            if (match) {
                const floatValue = parseFloat(match[0]);
                if (!isNaN(floatValue)) {
                    highlightFloatValue(span, floatValue);
                } else {
                    span.style.color = "";
                }
            } else {
                span.style.color = "";
            }
        });

        document.querySelectorAll('.header[data-csfloat-data]').forEach((header) => {
            try {
                const data = JSON.parse(header.getAttribute('data-csfloat-data') || '{}');
                const floatValue = data?.item?.float_value;
                const floatContainer = header.querySelector('.float') as HTMLElement | null;
                if (floatContainer) {
                    if (typeof floatValue === 'number' && !isNaN(floatValue)) {
                        highlightFloatValue(floatContainer, floatValue);
                    } else {
                        floatContainer.style.color = "";
                    }
                }
            } catch (e) {
                // ignore parse errors
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
            highlightAllMatchingText();
        };

        scan();
        new MutationObserver(scan).observe(document.body, { childList: true, subtree: true, characterData: true });
    });
})();
