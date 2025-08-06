// Utility to parse offer amounts like "$103.04"
(() => {
    console.log("Bargain Helper loaded");

    function parseOfferAmount(text: string): number {
        return parseFloat(text.replace(/[^0-9.]/g, ""));
    }

    interface OfferInfo {
        element: HTMLElement;
        amount: number;
        discountPercent: number;
        status: 'accepted' | 'rejected' | 'counter' | 'initial';
        isBuyer: boolean;
    }

    function parseDiscount(text: string): number {
        const match = text.match(/\(([-\d.]+)% off\)/i);
        if (!match) return 0;
        return parseFloat(match[1]);
    }

    function detectOffers(): OfferInfo[] {
        const historySections = document.querySelectorAll(".history");
        const offerBubbles = historySections.length >= 2
            ? Array.from(historySections[1].querySelectorAll(".offer-bubble"))
            : [];

        const offers: OfferInfo[] = [];

        for (const el of offerBubbles) {
            //console.log("Checking offer:", el);
            const headlineText = el.querySelector(".headline")?.textContent?.toLowerCase() || "";
            const subText = el.querySelector(".sub-text")?.textContent?.toLowerCase() || "";
            const amountText = el.querySelector(".price")?.textContent || "";
            const discountText = el.querySelector(".discount")?.textContent || "";

            const amount = parseOfferAmount(amountText);
            const discountPercent = parseDiscount(discountText);
            if (!amount) continue;

            let status: OfferInfo['status'] = "initial";
            const iconEl = el.querySelector("mat-icon");
            const svgIcon = iconEl?.getAttribute("svgicon") || "";

            if (svgIcon === "offer_cancelled") {
                status = "rejected";
            } else if (svgIcon === "offer_accepted") {
                status = "accepted";
            } else if (headlineText.includes("counter")) {
                status = "counter";
            }

            const isBuyer = subText.includes("buyer");

            offers.push({ element: el as HTMLElement, amount, discountPercent, status, isBuyer });
        }

        return offers;
    }

    function observeOffers() {
        const observer = new MutationObserver(() => {
            const historySections = document.querySelectorAll(".history");
            const secondHistory = historySections[1];
            const offerBubbles = secondHistory?.querySelectorAll(".offer-bubble") || [];

            if (offerBubbles.length > 0) {
                const offers = detectOffers();
                console.log("Detected offers:", offers);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    observeOffers();
})();
