(function () {
    console.log("[FETCH INTERCEPT LOADED]");
    const originalFetch = window.fetch;
    const tolerance = 0.00001;

    function attachListingsToCards(listings) {
        const cards = document.querySelectorAll("item-card");
        listings?.forEach((entry) => {
            const float = entry?.item?.float_value;
            if (typeof float !== "number") return;

            for (const card of cards) {
                const wearText = card.querySelector(".wear")?.textContent?.trim();
                const cardFloat = wearText ? parseFloat(wearText) : NaN;
                if (!isNaN(cardFloat) && Math.abs(cardFloat - float) < tolerance) {
                    card.dataset.csfloatData = JSON.stringify(entry);
                    //console.log("[Linked Item to Card]", float, entry.item);
                    break;
                }
            }
        });
    }

    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        const url = args[0];

        if (typeof url === "string" && url.includes("/api/v1/listings?")) {
            try {
                const cloned = response.clone();
                const json = await cloned.json();
                const listings = json?.data;
                window.postMessage({ type: "CSFLOAT_LISTINGS", payload: listings }, "*");
                //console.log("[Intercepted Listings via fetch]", listings);

                setTimeout(() => attachListingsToCards(listings), 300);
            } catch (err) {
                console.warn("Failed to parse listings (fetch):", err);
            }
        }

        return response;
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) {
        this.addEventListener("load", function () {
            try {
                const url = this.responseURL;
                if (url.includes("/api/v1/listings?")) {
                    const json = JSON.parse(this.responseText);
                    const listings = json?.data;
                    window.postMessage({ type: "CSFLOAT_LISTINGS", payload: listings }, "*");
                    //console.log("[Intercepted Listings via XHR]", listings);

                    setTimeout(() => attachListingsToCards(listings), 300);
                }
            } catch (err) {
                console.warn("XHR failed to parse listings:", err);
            }
        });
        return originalOpen.apply(this, args);
    };
})();
