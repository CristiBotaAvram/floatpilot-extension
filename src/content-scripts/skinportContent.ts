console.log("✅ FloatPilot: Skinport content script loaded.");

interface BetterDealInfo {
    price: number;
    usdPrice: number;
    float: number;
    link: string;
}

interface CSFloatListing {
    id: string;
    price: number;
    item: {
        float_value: number;
    };
}

let betterDealInfo: BetterDealInfo | null = null;
let addToCartButton: HTMLButtonElement | null = null;
let overlay: HTMLDivElement | null = null;

async function getLiveConversionRate(targetCurrency: string): Promise<number> {
    if (targetCurrency === 'USD') return 1;
    try {
        const response = await fetch(`https://api.exchangerate.host/latest?base=USD&symbols=${targetCurrency}`);
        const data = await response.json();
        return data.rates?.[targetCurrency] || 1;
    } catch (error) {
        console.error("❌ Failed to fetch conversion rate:", error);
        return 1;
    }
}

function getWearCategory(float: number): string {
    if (float <= 0.07) return "Factory New";
    if (float <= 0.15) return "Minimal Wear";
    if (float <= 0.38) return "Field-Tested";
    if (float <= 0.45) return "Well-Worn";
    return "Battle-Scarred";
}

let lastUrl = location.href;
new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log(`🔄 FloatPilot: URL changed to ${currentUrl}`);
        if (currentUrl.includes('/item/')) {
            console.log("✅ FloatPilot: New item page detected after navigation.");
            waitForSkinportData();
        }
    }
}).observe(document, { subtree: true, childList: true });

if (window.location.pathname.startsWith('/item/')) {
    waitForSkinportData();
}

function roundPrice(value: number): number {
    return Math.round(value * 100) / 100;
}

async function waitForSkinportData(): Promise<void> {
    const itemTypeElement = document.querySelector('.ItemPage-title');
    const itemNameElement = document.querySelector('.ItemPage-name');
    const wearElement = document.querySelector('.WearBar-value');
    const priceElement = document.querySelector('.ItemPage-value .Tooltip-link');
    const currencyElement = document.querySelector('.ItemPage-currency');

    if (itemTypeElement && itemNameElement && wearElement && priceElement) {
        const itemType = itemTypeElement.textContent?.trim() || 'Unknown Type';
        const itemName = itemNameElement.textContent?.trim() || 'Unknown Name';
        const wearText = wearElement.textContent?.trim() || '0';
        const priceText = priceElement.textContent?.trim() || '0';

        const cleanedPrice = priceText.replace(/[^0-9,]/g, '').replace(',', '.');
        const price = parseFloat(cleanedPrice) || 0;
        const float = parseFloat(wearText) || 0;

        const currency = currencyElement?.textContent?.trim() || 'EUR';
        console.log(`💶 Detected Skinport currency: ${currency}`);

        const conversionRate = await getLiveConversionRate(currency);

        const wearCategory = getWearCategory(float);

        let prefix = "";
        if (itemType.includes("Gloves") || itemType.includes("Knife")) {
            prefix = "★ ";
        }

        const fullName = `${prefix}${itemType} | ${itemName} (${wearCategory})`;

        console.log(`🛒 Detected Skinport item: ${fullName} | Price: €${price} | Float: ${float}`);

        searchCSFloatForBetterDeal(fullName, price, float, currency, conversionRate);

        addToCartButton = document.querySelector('.SubmitButton.SubmitButton--isFull') as HTMLButtonElement;

        if (addToCartButton) {
            addToCartButton.addEventListener('click', (e) => {
                if (betterDealInfo) {
                    e.preventDefault();
                    showBetterDealPopup(betterDealInfo.price, betterDealInfo.usdPrice, betterDealInfo.float, betterDealInfo.link);
                    betterDealInfo = null;
                }
            });
        }
    } else {
        setTimeout(waitForSkinportData, 100);
    }
}

function searchCSFloatForBetterDeal(itemName: string, originalPrice: number, originalFloat: number, currency: string, conversionRate: number): void {
    chrome.runtime.sendMessage({ type: "searchCSFloat", itemName, maxFloat: originalFloat }, (response) => {
        if (!response || !response.success) {
            console.error("❌ FloatPilot: Error fetching data from background.");
            return;
        }

        const listings: CSFloatListing[] = response.data || [];

        console.log(`🔎 FloatPilot: Found ${listings.length} CSFloat listings.`);

        if (listings.length === 0) return;

        listings.sort((a, b) => (a.price || 0) - (b.price || 0));

        let betterDealFound = false;
        let betterDealLink = '';
        let betterDealPrice = 0;
        let betterDealFloat = 0;
        let betterDealUSD = 0;

        listings.forEach((listing) => {
            let csfloatPrice = (listing.price || 0) / 100;
            const csfloatUSD = csfloatPrice;

            if (currency !== 'USD') {
                csfloatPrice = csfloatPrice * conversionRate;
            }

            const float = listing.item?.float_value || 0;
            const id = listing.id || '';

            const link = `https://csfloat.com/item/${id}`;

            if (float <= originalFloat * 1.01 && csfloatPrice < originalPrice) {
                betterDealFound = true;
                betterDealPrice = roundPrice(csfloatPrice);
                betterDealFloat = float;
                betterDealLink = link;
                betterDealUSD = roundPrice(csfloatUSD);

                console.log(`🚨 Better deal: €${betterDealPrice.toFixed(2)} (USD $${betterDealUSD.toFixed(2)}) | Float: ${betterDealFloat} | Link: ${betterDealLink}`);
            }
        });

        if (betterDealFound) {
            betterDealInfo = {
                price: betterDealPrice,
                usdPrice: betterDealUSD,
                float: betterDealFloat,
                link: betterDealLink
            };
        } else {
            console.log(`✅ FloatPilot: No better deal found.`);
        }
    });
}

function showBetterDealPopup(price: number, usdPrice: number, float: number, link: string): void {
    overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
    overlay.style.zIndex = '9998';
    document.body.appendChild(overlay);

    const popup = document.createElement('div');
    popup.style.position = 'fixed';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%) scale(0.8)';
    popup.style.padding = '24px';
    popup.style.backgroundColor = '#2f4f2f';
    popup.style.color = 'white';
    popup.style.borderRadius = '12px';
    popup.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
    popup.style.zIndex = '9999';
    popup.style.maxWidth = '400px';
    popup.style.fontSize = '16px';
    popup.style.textAlign = 'center';
    popup.style.transition = 'transform 0.3s ease';

    popup.innerHTML = `
        <div style="margin-bottom: 12px;"><strong>💎 Better deal found on CSFloat!</strong></div>
        <div style="margin-bottom: 6px;">Price: €${price.toFixed(2)} (USD $${usdPrice.toFixed(2)})</div>
        <div style="margin-bottom: 12px;">Float: ${float}</div>
        <a href="${link}" target="_blank" style="display:inline-block; background:#00ffae; padding:10px 14px; color:black; text-decoration:none; border-radius:8px; font-weight:bold;">View on CSFloat</a>
        <br><br>
        <button id="continuePurchaseBtn" style="background:transparent; border:2px solid #00ffae; padding:8px 14px; color:#00ffae; border-radius:8px; cursor:pointer; font-weight:bold;">Continue Purchase</button>
    `;

    document.body.appendChild(popup);

    requestAnimationFrame(() => {
        popup.style.transform = 'translate(-50%, -50%) scale(1)';
    });

    const continueBtn = document.getElementById('continuePurchaseBtn');
    continueBtn?.addEventListener('click', () => {
        popup.remove();
        overlay?.remove();
        addToCartButton?.click();
    });
}