console.log("✅ FloatPilot: Setting up smart MutationObserver...");

type Sale = {
    date: string;
    price: number;
};

// 🛠 New function to fetch sale history via background.ts
function fetchSaleHistoryFromBackground(itemName: string): Promise<any> {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "fetchSaleHistory", itemName }, (response) => {
            if (response && response.success) {
                resolve(response.data);
            } else {
                reject(new Error("Failed to fetch sale history"));
            }
        });
    });
}

function grabListings() {
    const listings = document.querySelectorAll('item-card');

    console.log(`Found ${listings.length} item cards!`);

    const items: { name: string, price: number, float: number, element: HTMLElement }[] = [];

    listings.forEach(async (listing) => {
        const name = listing.querySelector('.item-name')?.textContent?.trim() || 'Unknown Name';
        const priceText = listing.querySelector('.price')?.textContent?.trim().replace('$', '') || '0';
        const floatText = listing.querySelector('.wear')?.textContent?.trim() || '0';

        const price = parseFloat(priceText.replace(',', '')) || 0;
        const float = parseFloat(floatText) || 0;

        const item = {
            name,
            price,
            float,
            element: listing as HTMLElement
        };

        items.push(item);

        console.log(`🖎 ${name} | Price: $${price} | Float: ${float}`);

        // 🛠 New: Fetch sales history from background script
        const salesData = await fetchSaleHistoryFromBackground(name);

        const last30DaysSales = (salesData.sales as Sale[]).filter((sale) => {
            const saleDate = new Date(sale.date);
            const now = new Date();
            const daysAgo30 = new Date(now.setDate(now.getDate() - 30));
            return saleDate > daysAgo30;
        });

        const salePrices = last30DaysSales.map((sale) => sale.price);

        if (salePrices.length > 0) {
            const averagePrice = salePrices.reduce((a, b) => a + b, 0) / salePrices.length;
            console.log(`📈 Average sale price for ${name}: $${averagePrice.toFixed(2)}`);
        }

        // ✅ Change card background and buttons if Price > 100
        if (price > 100) {
            const card = listing.querySelector('mat-card') as HTMLElement;
            const buyNowButton = listing.querySelector('.buy-now-btn') as HTMLElement;
            const addToCartButton = listing.querySelector('.cart-btn') as HTMLElement;
            const bargainButton = listing.querySelector('.bargain-btn') as HTMLElement;
            const priceElement = listing.querySelector('.price') as HTMLElement;
            const actionsContainer = listing.querySelector('.actions-container') as HTMLElement;
            const outerActions = listing.querySelector('.outer-actions') as HTMLElement;

            const backgroundColor = '#2f4f2f'; // dark green
            const buttonBorderStyle = '2px solid black';

            if (card) {
                card.style.background = backgroundColor;
                card.style.transition = 'background 0.3s ease';
            }
            if (buyNowButton) {
                buyNowButton.style.background = backgroundColor;
                buyNowButton.style.border = buttonBorderStyle;
                buyNowButton.style.borderRadius = '8px';
                buyNowButton.style.transition = 'background 0.3s ease, border 0.3s ease';
            }
            if (addToCartButton) {
                addToCartButton.style.background = backgroundColor;
                addToCartButton.style.border = buttonBorderStyle;
                addToCartButton.style.borderRadius = '8px';
                addToCartButton.style.transition = 'background 0.3s ease, border 0.3s ease';
            }
            if (bargainButton) {
                bargainButton.style.background = backgroundColor;
                bargainButton.style.border = buttonBorderStyle;
                bargainButton.style.borderRadius = '8px';
                bargainButton.style.transition = 'background 0.3s ease, border 0.3s ease';
            }
            if (priceElement) {
                priceElement.style.background = backgroundColor;
                priceElement.style.borderRadius = '8px';
                priceElement.style.padding = '2px 4px';
            }
            if (actionsContainer) {
                actionsContainer.style.background = backgroundColor;
                actionsContainer.style.borderRadius = '8px';
                actionsContainer.style.transition = 'background 0.3s ease';
            }
            if (outerActions) {
                outerActions.style.background = backgroundColor;
                outerActions.style.borderRadius = '8px';
                outerActions.style.transition = 'background 0.3s ease';
            }
        }
    });

    console.log("✅ All items collected:", items);
}

function startObserver() {
    const container = document.querySelector('.item-grid');

    if (!container) {
        console.log("❌ FloatPilot: item-grid not found, retrying...");
        setTimeout(startObserver, 1000);
        return;
    }

    console.log("✅ FloatPilot: Found item-grid, starting observer.");

    const observer = new MutationObserver(() => {
        console.log("✅ FloatPilot: Detected listing update!");
        setTimeout(() => {
            grabListings();
        }, 500); // Wait 500ms to let CSFloat render properly
    });

    observer.observe(container, {
        childList: true,
        subtree: true
    });

    // 🛠 Detect when user clicks CSFloat refresh button
    const refreshButton = document.querySelector('.refresh button');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            console.log("🔄 FloatPilot: Refresh button clicked, grabbing listings...");
            setTimeout(() => {
                grabListings();
            }, 800); // Wait slightly longer because CSFloat might reload slower
        });
    } else {
        console.log("⚠️ FloatPilot: Refresh button not found yet.");
    }

    // Initial scan
    grabListings();
}

startObserver();
