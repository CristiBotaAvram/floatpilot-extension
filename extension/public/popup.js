// FloatPilot popup logic (MV3)
// Fetches user info from floatpilot.store using session cookie
// Handles login redirect, loading UI, and setting toggle states

document.addEventListener('DOMContentLoaded', async () => {
    const avatarEl = document.getElementById('avatar');
    const usernameEl = document.getElementById('username');
    const planEl = document.getElementById('plan');
    const badgeEl = document.querySelector('.badge');

    // Initial loading state
    avatarEl.style.opacity = '0.4';
    usernameEl.textContent = 'Loading...';
    badgeEl.textContent = '...';

    try {
        const res = await fetch('https://floatpilot.store/api/me', {
            credentials: 'include'
        });

        const data = await res.json();

        if (!res.ok || !data.loggedIn) {
            throw new Error('Not authenticated');
        }

        avatarEl.src = data.avatarUrl;
        avatarEl.style.opacity = '1';
        usernameEl.textContent = data.displayName;
        planEl.textContent = data.tier;
        badgeEl.textContent = data.tier;

        // Load toggle settings per user from local storage (per SteamID64)
        const userKey = `floatpilot_settings_${data.steamID64}`;
        chrome.storage.local.get(userKey, (result) => {
            const toggles = result[userKey] || {};
            document.getElementById('toggle-cheaper').checked = toggles.cheaper ?? false;
            document.getElementById('toggle-other').checked = toggles.other ?? true;
        });

        // Attach listeners to sync state changes
        ['toggle-cheaper', 'toggle-other'].forEach(id => {
            document.getElementById(id).addEventListener('change', async () => {
                const updatedSettings = {
                    cheaper: document.getElementById('toggle-cheaper').checked,
                    other: document.getElementById('toggle-other').checked
                };
                const toSave = {};
                toSave[userKey] = updatedSettings;
                chrome.storage.local.set(toSave);
            });
        });

    } catch (err) {
        console.warn('[FloatPilot popup] Not logged in or failed to fetch:', err);
        usernameEl.textContent = 'Not logged in';
        planEl.textContent = '';
        badgeEl.textContent = 'Guest';
        avatarEl.style.opacity = '0.3';

        // Optional: redirect user to login
        setTimeout(() => {
            chrome.tabs.create({ url: 'https://floatpilot.store' });
        }, 1500);
    }
});
