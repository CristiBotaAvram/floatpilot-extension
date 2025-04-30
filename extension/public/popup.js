// FloatPilot popup logic (MV3)
// Saves + restores API key using chrome.storage.local

(function () {
    // Run after DOM is ready
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        const input  = /** @type {HTMLInputElement} */ (document.getElementById('apiKeyInput'));
        const save   = /** @type {HTMLButtonElement} */ (document.getElementById('saveBtn'));
        const status = /** @type {HTMLDivElement} */ (document.getElementById('status'));

        // Prefill field with stored key
        chrome.storage.local.get('apiKey', ({ apiKey }) => {
            if (chrome.runtime.lastError) {
                console.error('[FloatPilot popup] storage.get error', chrome.runtime.lastError);
                return;
            }
            if (apiKey) input.value = apiKey;
        });

        // Save handler
        save.addEventListener('click', () => {
            const apiKey = input.value.trim();
            chrome.storage.local.set({ apiKey }, () => {
                if (chrome.runtime.lastError) {
                    console.error('[FloatPilot popup] storage.set error', chrome.runtime.lastError);
                    status.textContent = '⚠ Error saving';
                    status.style.color = '#f44336';
                } else {
                    status.textContent = '✔ Saved!';
                    status.style.color = '#4caf50';
                }
                status.style.display = 'block';
                setTimeout(() => (status.style.display = 'none'), 2000);
            });
        });
    }
})();
