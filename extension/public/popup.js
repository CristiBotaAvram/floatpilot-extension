document.addEventListener('DOMContentLoaded', async () => {
    const avatarEl = document.getElementById('avatar');
    const usernameEl = document.getElementById('username');
    const planEl = document.getElementById('plan');
    const badgeEl = document.getElementById('footerTier');
    const loginBtn = document.getElementById('loginBtn');
    const settingsEls = document.querySelectorAll('.setting');

    function setFallbackUI() {
        avatarEl.src = 'default-avatar.png';
        usernameEl.textContent = 'Not logged in';
        planEl.textContent = '';
        badgeEl.textContent = 'Guest';
    }

    function getOverlayByText(text) {
        return Array.from(document.querySelectorAll('.locked-overlay')).find(el => el.textContent.includes(text));
    }

    /**
     * Bind checkboxes and number inputs inside each .setting element
     * so their state persists in chrome.storage.local under a user‑scoped key.
     */
    function bindSettings(steamID64, tier) {
        const storageKey = `floatpilot_settings_${steamID64}`;

        chrome.storage.local.get(storageKey, (result) => {
            const storedSettings = result[storageKey] || {};

            settingsEls.forEach(el => {
                const key = el.dataset.key;
                if (!key) return;

                const checkbox = el.querySelector('.checkbox');
                const numberInput = /** @type {HTMLInputElement|null} */ (el.querySelector('input[type="number"]'));

                // --- checkbox behaviour ---
                if (checkbox) {
                    const checked = !!storedSettings[key];
                    checkbox.classList.toggle('checked', checked);

                    el.addEventListener('click', () => {
                        // ignore clicks that originate from a number input inside the same setting
                        if (numberInput && numberInput === document.activeElement) return;

                        const nowChecked = !checkbox.classList.contains('checked');
                        checkbox.classList.toggle('checked', nowChecked);

                        const newSettings = { ...storedSettings, [key]: nowChecked };
                        chrome.storage.local.set({ [storageKey]: newSettings });
                    });
                }

                // --- number input behaviour ---
                if (numberInput) {
                    if (storedSettings[key] !== undefined) {
                        numberInput.value = storedSettings[key];
                    }

                    numberInput.addEventListener('input', () => {
                        const val = numberInput.value.trim();
                        const newSettings = { ...storedSettings };

                        if (val === '') {
                            delete newSettings[key];
                        } else {
                            newSettings[key] = Number(val);
                        }

                        chrome.storage.local.set({ [storageKey]: newSettings });
                    });
                }
            });
        });

        // Unlock Co‑Pilot settings if user has Co‑Pilot or Commander
        if (tier === 'Co-Pilot' || tier === 'Commander') {
            const coPilotOverlay = getOverlayByText('Co-Pilot');
            if (coPilotOverlay) coPilotOverlay.remove();
            document.querySelectorAll('[data-key="itemEstimation"], [data-key="profitTarget"], [data-key="listingCardHighlight"], [data-key="manipulationWarning"]').forEach(el => {
                el.classList.remove('locked');
            });
        }

        // Unlock Commander settings if user has Commander
        if (tier === 'Commander') {
            const commanderOverlay = getOverlayByText('Commander');
            if (commanderOverlay) commanderOverlay.remove();
            document.querySelectorAll('[data-key="removeAffiliate"], [data-key="editStickers"], [data-key="estimateMethod"], [data-key="rarePatterns"], [data-key="flippability"]').forEach(el => {
                el.classList.remove('locked');
            });
        }
    }

    try {
        const res = await fetch('https://floatpilot.store/api/me', {
            credentials: 'include'
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const data = await res.json();
        if (!data.loggedIn) throw new Error('Not logged in');

        // Display user info
        avatarEl.src = data.avatarUrl;
        usernameEl.textContent = data.displayName;
        planEl.textContent = data.tier;
        badgeEl.textContent = data.tier;

        // Cache user info
        chrome.storage.local.set({ floatpilot_user: data });

        // Load + bind toggles / inputs
        bindSettings(data.steamID64, data.tier);

    } catch (err) {
        console.warn('[FloatPilot] API fetch failed, fallback to cache', err);

        chrome.storage.local.get('floatpilot_user', ({ floatpilot_user }) => {
            if (floatpilot_user && floatpilot_user.loggedIn) {
                console.log('[FloatPilot] Loaded user from cache');
                avatarEl.src = floatpilot_user.avatarUrl;
                usernameEl.textContent = floatpilot_user.displayName;
                planEl.textContent = floatpilot_user.tier;
                badgeEl.textContent = floatpilot_user.tier;
                bindSettings(floatpilot_user.steamID64, floatpilot_user.tier);
            } else {
                console.warn('[FloatPilot] No user info found');
                setFallbackUI();
                loginBtn.style.display = 'block';
            }
        });
    }

    loginBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://floatpilot.store/' });
    });

    document.body.addEventListener('click', e => {
        if (e.target.matches('.upgrade-btn')) {
            chrome.tabs.create({ url: 'https://floatpilot.store/manage-subscription' });
        }
    });
});
