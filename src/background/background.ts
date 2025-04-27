const API_KEY = "Z9B4w5Z1BaxXBt2j4orupfXSF-k5xaKi"; // Your CSFloat API Key

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "searchCSFloat") {
        const searchUrl = `https://csfloat.com/api/v1/listings?market_hash_name=${encodeURIComponent(message.itemName)}&sort_by=lowest_price&max_float=${message.maxFloat}&limit=1`;

        console.log(`🌐 FloatPilot: Fetching URL -> ${searchUrl}`);

        fetch(searchUrl, {
            method: 'GET',
            headers: {
                'Authorization': API_KEY,
                'Accept': 'application/json'
            }
        })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
                return response.json();
            })
            .then(data => {
                if (data.data && data.data.length > 0) {
                    sendResponse({ success: true, data: data.data });
                } else {
                    // Retry without max_float if no listings found
                    const fallbackUrl = `https://csfloat.com/api/v1/listings?market_hash_name=${encodeURIComponent(message.itemName)}&sort_by=lowest_price&limit=1`;
                    console.log(`🔁 No results, retrying without max_float -> ${fallbackUrl}`);
                    fetch(fallbackUrl, {
                        method: 'GET',
                        headers: {
                            'Authorization': API_KEY,
                            'Accept': 'application/json'
                        }
                    })
                        .then(fallbackResponse => {
                            if (!fallbackResponse.ok) throw new Error(`HTTP Error ${fallbackResponse.status}`);
                            return fallbackResponse.json();
                        })
                        .then(fallbackData => {
                            sendResponse({ success: true, data: fallbackData.data });
                        })
                        .catch(fallbackError => {
                            console.error('❌ FloatPilot fallback fetch error:', fallbackError);
                            sendResponse({ success: false, error: fallbackError.message });
                        });
                }
            })
            .catch(error => {
                console.error('❌ FloatPilot background fetch error:', error);
                sendResponse({ success: false, error: error.message });
            });

        return true;
    }
});