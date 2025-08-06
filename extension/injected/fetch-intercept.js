(function () {
    console.log("[FETCH INTERCEPT LOADED]");
    const originalFetch = window.fetch;
    const tolerance = 0.000000001;

    function cleanEntry(entry) {
        delete entry.seller;
        if (entry.item) {
            delete entry.item.asset_id;
            delete entry.item.icon_url;
            delete entry.item.d_param;
            delete entry.item.inspect_link;
            delete entry.item.cs2_screenshot_id;
            delete entry.item.cs2_screenshot_at;
            delete entry.item.is_commodity;
            delete entry.item.type;
            delete entry.item.rarity_name;
            delete entry.item.type_name;
            delete entry.item.item_name;
            delete entry.item.wear_name;
            delete entry.item.description;
            delete entry.item.collection;
            delete entry.item.serialized_inspect;
            delete entry.item.gs_sig;

            if (Array.isArray(entry.item.stickers)) {
                for (const sticker of entry.item.stickers) {
                    delete sticker.icon_url;
                    delete sticker.name;
                    delete sticker.offset_x;
                    delete sticker.offset_y;
                }
            }
            if (Array.isArray(entry.item.keychains)) {
                for (const keychain of entry.item.keychains) {
                    delete keychain.offset_x;
                    delete keychain.offset_y;
                    delete keychain.offset_z;
                    delete keychain.icon_url;
                    delete keychain.name;
                }
            }
        }
        return entry;
    }

    function attachListingsToCards(listings) {
        const cards = document.querySelectorAll("item-card");
        (Array.isArray(listings) ? listings : [listings])?.forEach((entry) => {
            const float = entry?.item?.float_value;
            if (typeof float !== "number") return;

            for (const card of cards) {
                const wearText = card.querySelector(".wear")?.textContent?.trim();
                const cardFloat = wearText ? parseFloat(wearText) : NaN;
                if (!isNaN(cardFloat) && Math.abs(cardFloat - float) < tolerance) {
                    const cleaned = cleanEntry({ ...entry });
                    card.dataset.csfloatData = JSON.stringify(cleaned);
                }
            }
        });
    }

    function attachOffersToCards(offers) {
        const offerHeaders = document.querySelectorAll(".header");

        (Array.isArray(offers) ? offers : [offers])?.forEach((offer) => {
            const item = offer?.contract;
            const float = item?.item?.float_value;
            if (typeof float !== "number") return;

            for (const header of offerHeaders) {
                const floatDiv = header.querySelector(".float");
                const cardFloat = floatDiv ? parseFloat(floatDiv.textContent) : NaN;
                if (!isNaN(cardFloat) && Math.abs(cardFloat - float) < tolerance) {
                    const cleaned = cleanEntry({ ...item });
                    header.dataset.csfloatData = JSON.stringify(cleaned);
                    //break;
                }
            }
        });
    }

    window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        const url = args[0];

        if (typeof url === "string") {
            try {
                const cloned = response.clone();
                const json = await cloned.json();

                if (url.includes("/api/v1/listings")) {
                    const listings = json?.data ?? json;
                    window.postMessage({ type: "CSFLOAT_LISTINGS", payload: listings }, "*");
                    setTimeout(() => attachListingsToCards(listings), 300);
                }

                if (url.includes("/api/v1/me/offers-timeline")) {
                    const offers = json?.offers ?? [];
                    setTimeout(() => attachOffersToCards(offers), 300);
                }
            } catch (err) {
                console.warn("Failed to parse response (fetch):", err);
            }
        }

        return response;
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) {
        this.addEventListener("load", function () {
            try {
                const url = this.responseURL;
                if (url.includes("/api/v1/listings")) {
                    const json = JSON.parse(this.responseText);
                    const listings = json?.data ?? json;
                    //console.log('The url:', url, json);
                    window.postMessage({ type: "CSFLOAT_LISTINGS", payload: listings }, "*");
                    setTimeout(() => attachListingsToCards(listings), 300);
                }
                if (url.includes("/api/v1/me/offers-timeline")) {
                    const json = JSON.parse(this.responseText);
                    const offers = json?.offers ?? [];
                    //console.log('The url:', url, json);
                    window.postMessage({ type: "CSFLOAT_LISTINGS", payload: offers.map(o => cleanEntry({ ...o.contract })) }, "*");
                    setTimeout(() => attachOffersToCards(offers), 300);
                }
            } catch (err) {
                console.warn("XHR failed to parse response:", err);
            }
        });
        return originalOpen.apply(this, args);
    };
})();
