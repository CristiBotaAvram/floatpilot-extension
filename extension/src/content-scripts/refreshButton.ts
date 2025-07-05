let autoRefreshActive = false;
let intervalId: number | null = null;
let selectedIntervalMs = 30000; // default 30s
let toggleInserted = false;

const INTERVAL_OPTIONS: { label: string; value: number }[] = [
    { label: '30s', value: 30000 },
    { label: '45s', value: 45000 },
    { label: '1 min', value: 60000 },
    { label: '2 min', value: 120000 },
    { label: '5 min', value: 300000 }
];

/**
 * Observes the document for DOM changes and inserts controls once the refresh container is ready.
 */
function observeDOMAndInsertToggle() {
    const observer = new MutationObserver(() => {
        const container = document.querySelector('div.refresh');
        const refreshButton = container?.querySelector('button');

        if (container && refreshButton && !toggleInserted) {
            toggleInserted = true;
            insertControls(container as HTMLElement, refreshButton as HTMLButtonElement);
        }

        // If the container disappears (e.g. navigation), reset toggleInserted so it can re-insert later
        if (!container && toggleInserted) {
            toggleInserted = false;
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

/**
 * Inserts both the toggle button and dropdown into the refresh container.
 */
function insertControls(container: HTMLElement, refreshButton: HTMLButtonElement) {
    // Toggle button
    const toggle = document.createElement('button');
    toggle.innerText = 'Auto Refresh OFF';
    toggle.style.padding = '6px 12px';
    toggle.style.marginLeft = '8px';
    toggle.style.borderRadius = '4px';
    toggle.style.backgroundColor = '#ef4444'; // red
    toggle.style.color = 'white';
    toggle.style.border = 'none';
    toggle.style.cursor = 'pointer';
    toggle.style.fontSize = '14px';

    // Dropdown
    const dropdown = document.createElement('select');
    dropdown.style.marginLeft = '8px';
    dropdown.style.padding = '6px';
    dropdown.style.borderRadius = '4px';
    dropdown.style.border = '1px solid #ccc';
    dropdown.style.fontSize = '14px';
    dropdown.style.cursor = 'pointer';

    INTERVAL_OPTIONS.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value.toString();
        option.text = opt.label;
        dropdown.appendChild(option);
    });

    dropdown.addEventListener('change', () => {
        selectedIntervalMs = parseInt(dropdown.value);
        if (autoRefreshActive) {
            stopAutoRefresh();
            startAutoRefresh(refreshButton);
        }
    });

    toggle.addEventListener('click', () => {
        autoRefreshActive = !autoRefreshActive;
        toggle.innerText = autoRefreshActive ? 'Auto Refresh ON' : 'Auto Refresh OFF';
        toggle.style.backgroundColor = autoRefreshActive ? '#22c55e' : '#ef4444';

        if (autoRefreshActive) {
            startAutoRefresh(refreshButton);
        } else {
            stopAutoRefresh();
        }
    });

    container.appendChild(toggle);
    container.appendChild(dropdown);
}

/**
 * Starts the interval that clicks the refresh button.
 */
function startAutoRefresh(button: HTMLButtonElement) {
    intervalId = window.setInterval(() => {
        button.click();
        console.log('[AutoRefresh] Clicked refresh button at', new Date().toLocaleTimeString());
    }, selectedIntervalMs);
}

/**
 * Stops the auto-refresh interval.
 */
function stopAutoRefresh() {
    if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

// Kick off the observer script
observeDOMAndInsertToggle();
