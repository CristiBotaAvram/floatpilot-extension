document.addEventListener('DOMContentLoaded', async () => {
    const configGrid = document.getElementById('configGrid') as HTMLElement;
    const sortSelect = document.getElementById('sortSelect') as HTMLSelectElement;
    const searchInput = document.getElementById('searchInput') as HTMLInputElement;

    interface Config {
        id: string;
        name: string;
        description: string;
        creator_steam_id: string;
        ff_price: number;
        purchase_count: number;
        created_at: string;
    }

    let configs: Config[] = [];

    async function fetchConfigs(): Promise<void> {
        try {
            const response = await fetch('/api/configs');
            const data: Config[] = await response.json();
            configs = data;
            renderConfigs();
        } catch (err) {
            console.error('Failed to fetch configs:', err);
        }
    }

    function renderConfigs(): void {
        configGrid.innerHTML = '';
        const filtered = filterAndSort(configs);

        for (const config of filtered) {
            const card = document.createElement('div');
            card.className = 'bg-[#1a1a1a] p-4 rounded shadow hover:shadow-lg transition';

            card.innerHTML = `
        <h3 class="text-xl font-bold mb-1">${config.name}</h3>
        <p class="text-sm text-gray-400 mb-2">by ${config.creator_steam_id}</p>
        <p class="text-sm mb-3">${config.description || 'No description.'}</p>
        <div class="flex justify-between items-center">
          <span class="text-green-400 font-semibold">${config.ff_price} FF</span>
          <span class="text-xs text-gray-500">${config.purchase_count} sold</span>
        </div>
      `;

            configGrid.appendChild(card);
        }
    }

    function filterAndSort(configs: Config[]): Config[] {
        const search = searchInput.value.toLowerCase();
        let result = configs.filter(c =>
            c.name.toLowerCase().includes(search) ||
            (c.description?.toLowerCase().includes(search) ?? false)
        );

        const sort = sortSelect.value;
        if (sort === 'price_low') result.sort((a, b) => a.ff_price - b.ff_price);
        else if (sort === 'price_high') result.sort((a, b) => b.ff_price - a.ff_price);
        else if (sort === 'popular') result.sort((a, b) => b.purchase_count - a.purchase_count);
        else result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return result;
    }

    sortSelect.addEventListener('change', renderConfigs);
    searchInput.addEventListener('input', renderConfigs);

    await fetchConfigs();
});
