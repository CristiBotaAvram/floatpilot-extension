// popup.js

// Removed decryptConfig function — no longer needed

document.addEventListener('DOMContentLoaded', async () => {
    const avatarEl = document.getElementById('avatar');
    const usernameEl = document.getElementById('username');
    const planEl = document.getElementById('plan');
    const badgeEl = document.getElementById('footerTier');
    const loginBtn = document.getElementById('loginBtn');
    const settingsEls = document.querySelectorAll('.setting');
    const configSelectorSetting = document.getElementById('configSelectorSetting');
    const configDropdown = document.getElementById('configDropdown');

    function setFallbackUI() {
        avatarEl.src = 'default-avatar.png';
        usernameEl.textContent = 'Not logged in';
        planEl.textContent = '';
        badgeEl.textContent = 'Guest';
    }
    function cacheSelectedConfigIfMissing(configs, storedSettings, storageKey) {
        const storedId = storedSettings.selectedConfigId;
        const selectedOption = configDropdown.value;
        const selectedConfig = configs.find(cfg => cfg.id === selectedOption);

        if (!storedId && selectedConfig) {
            const updated = { ...storedSettings, selectedConfigId: selectedOption, selectedConfig };
            chrome.storage.local.set({ [storageKey]: updated });
            console.log('[FloatPilot] Auto-cached selected config:', selectedConfig);
        }
    }

    function bindSettings(steamID64, tier) {
        const storageKey = `floatpilot_settings_${steamID64}`;
        console.log('[FloatPilot] Binding settings for:', steamID64, 'Tier:', tier);

        chrome.storage.local.get(storageKey, async (result) => {
            const storedSettings = result[storageKey] || {};
            if (storedSettings.itemEstimation) {
                configSelectorSetting.style.display = 'flex';
                try {
                    console.log('[FloatPilot] Auto-fetching configs on popup open...');
                    const purchasedRes = await fetch('https://www.floatpilot.store/api/configs/purchased', {
                        method: 'GET',
                        headers: { 'x-steamid': steamID64 },
                        credentials: 'include'
                    });
                    const purchased = await purchasedRes.json();
                    const ids = purchased.map(p => p.config_id).join(',');

                    const detailsRes = await fetch(`https://www.floatpilot.store/api/configs?ids=${ids}`);
                    const configs = await detailsRes.json();

                    configDropdown.innerHTML = '';
                    configs.forEach(cfg => {
                        const opt = document.createElement('option');
                        opt.value = cfg.id;
                        opt.textContent = cfg.name;
                        configDropdown.appendChild(opt);
                    });

                    const storedId = storedSettings.selectedConfigId;
                    if (storedId) {
                        configDropdown.value = storedId;
                    }
                    cacheSelectedConfigIfMissing(configs, storedSettings, storageKey);

                    configDropdown.addEventListener('change', async () => {
                        const selectedConfigId = configDropdown.value;
                        const selectedConfig = configs.find(cfg => cfg.id === selectedConfigId);
                        chrome.storage.local.get(storageKey, result => {
                            const prev = result[storageKey] || {};
                            const updated = { ...prev, selectedConfigId, selectedConfig };
                            chrome.storage.local.set({ [storageKey]: updated });
                            console.log('[FloatPilot] Config changed:', selectedConfig);
                        });
                    });

                } catch (err) {
                    console.error('[FloatPilot] Failed to auto-load configs on popup open:', err);
                }
            }
            console.log('[FloatPilot] Loaded stored settings:', storedSettings);

            settingsEls.forEach(el => {
                const key = el.dataset.key;
                if (!key) return;

                const checkbox = el.querySelector('.checkbox');
                const numberInput = el.querySelector('input[type="number"]');

                if (checkbox) {
                    const checked = !!storedSettings[key];
                    checkbox.classList.toggle('checked', checked);

                    if (key === 'itemEstimation' && configSelectorSetting) {
                        configSelectorSetting.style.display = checked ? 'flex' : 'none';
                    }

                    el.addEventListener('click', async () => {
                        if (numberInput && numberInput === document.activeElement) return;

                        chrome.storage.local.get(storageKey, async result => {
                            const currentSettings = result[storageKey] || {};
                            const nowChecked = !checkbox.classList.contains('checked');
                            checkbox.classList.toggle('checked', nowChecked);

                            const updated = { ...currentSettings, [key]: nowChecked };
                            await chrome.storage.local.set({ [storageKey]: updated });

                            console.log('[FloatPilot] Updated setting:', key, nowChecked);

                            if (key === 'cheapestToggle') {
                                await chrome.storage.sync.set({ showPriceDiff: nowChecked });
                            }

                            if (key === 'itemEstimation' && configSelectorSetting) {
                                configSelectorSetting.style.display = nowChecked ? 'flex' : 'none';

                                if (nowChecked) {
                                    try {
                                        const purchasedRes = await fetch('https://www.floatpilot.store/api/configs/purchased', {
                                            method: 'GET',
                                            headers: { 'x-steamid': steamID64 },
                                            credentials: 'include'
                                        });
                                        const purchased = await purchasedRes.json();
                                        const ids = purchased.map(p => p.config_id).join(',');

                                        const detailsRes = await fetch(`https://www.floatpilot.store/api/configs?ids=${ids}`);
                                        const configs = await detailsRes.json();

                                        configDropdown.innerHTML = '';
                                        configs.forEach(cfg => {
                                            const opt = document.createElement('option');
                                            opt.value = cfg.id;
                                            opt.textContent = cfg.name;
                                            configDropdown.appendChild(opt);
                                        });

                                        const storedId = currentSettings.selectedConfigId;
                                        if (storedId) {
                                            configDropdown.value = storedId;
                                        }
                                        cacheSelectedConfigIfMissing(configs, currentSettings, storageKey);

                                        configDropdown.addEventListener('change', async () => {
                                            const selectedConfigId = configDropdown.value;
                                            const selectedConfig = configs.find(cfg => cfg.id === selectedConfigId);
                                            chrome.storage.local.get(storageKey, result => {
                                                const prev = result[storageKey] || {};
                                                const updated = { ...prev, selectedConfigId, selectedConfig };
                                                chrome.storage.local.set({ [storageKey]: updated });
                                                console.log('[FloatPilot] Config changed:', selectedConfig);
                                            });
                                        });

                                    } catch (error) {
                                        console.error('Failed to load configs:', error);
                                    }
                                }
                            }
                        });
                    });
                }

                if (numberInput) {
                    if (storedSettings[key] !== undefined) {
                        numberInput.value = storedSettings[key];
                    }

                    numberInput.addEventListener('input', () => {
                        const val = numberInput.value.trim();
                        chrome.storage.local.get(storageKey, result => {
                            const currentSettings = result[storageKey] || {};
                            const updatedSettings = { ...currentSettings };

                            if (val === '') {
                                delete updatedSettings[key];
                            } else {
                                updatedSettings[key] = Number(val);
                            }
                            chrome.storage.local.set({ [storageKey]: updatedSettings });
                            console.log('[FloatPilot] Number input saved:', key, updatedSettings[key]);
                        });
                    });
                }
            });
        });

        if (tier === 'Pro') {
            const overlay = document.querySelector('.locked-overlay');
            if (overlay) overlay.remove();
            document.querySelectorAll('.setting.locked').forEach(el => {
                el.classList.remove('locked');
            });

            planEl.style.backgroundColor = '#0068ff';
            badgeEl.style.backgroundColor = '#0068ff';
            planEl.textContent = 'Pro';
            badgeEl.textContent = 'Pro';
        } else {
            planEl.style.backgroundColor = '#808080';
            badgeEl.style.backgroundColor = '#334155';
            planEl.textContent = 'Free';
            badgeEl.textContent = 'Free';
        }
    }

    try {
        const res = await fetch('https://www.floatpilot.store/api/me', {
            credentials: 'include'
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const data = await res.json();
        if (!data.loggedIn) throw new Error('Not logged in');

        avatarEl.src = data.avatarUrl;
        usernameEl.textContent = data.displayName;

        bindSettings(data.steamID64, data.tier);
        await chrome.storage.local.set({ floatpilot_user: data });
        console.log('[FloatPilot] User info saved and bound:', data);

    } catch (err) {
        console.warn('[FloatPilot] API fetch failed, fallback to cache', err);

        chrome.storage.local.get('floatpilot_user', ({ floatpilot_user }) => {
            if (floatpilot_user && floatpilot_user.loggedIn) {
                console.log('[FloatPilot] Loaded user from cache');
                avatarEl.src = floatpilot_user.avatarUrl;
                usernameEl.textContent = floatpilot_user.displayName;
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
            chrome.tabs.create({ url: 'https://floatpilot.store/' });
        }
    });
});
