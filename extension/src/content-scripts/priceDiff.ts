// priceDiff.ts ────────────────────────────────────────────
// Caching with persistent storage, in‑flight request queue
// Adds profit badge to every listing once (skins + misc items)
// -----------------------------------------------------------
(() => {
interface CacheEntry {
    price: number | null
    timestamp: number
}

const priceCache: Record<string, CacheEntry> = {}
const pending = new Map<string, Promise<number | null>>()
const POSITIVE_TTL = 60 * 60 * 1000
const NULL_TTL = 10 * 60 * 1000

chrome.storage.local.get('priceCache', (res: { priceCache?: Record<string, CacheEntry> }) => {
    if (res.priceCache) Object.assign(priceCache, res.priceCache)
})

const persistCache = () => chrome.storage.local.set({ priceCache })

async function fetchCheapest(hash: string): Promise<number | null> {
    const url = `https://csfloat.com/api/v1/listings?market_hash_name=${encodeURIComponent(hash)}&sort_by=lowest_price&limit=1&type=buy_now`
    //console.log('[PriceDiff] API', url)
    try {
        const r = await fetch(url, { credentials: 'include' })
        const j = await r.json()
        return j?.data?.[0]?.price ?? null
    } catch (e) {
        console.error('[PriceDiff] API error', e)
        return null
    }
}

async function getCheapest(hash: string): Promise<number | null> {
    const now = Date.now()
    const cached = priceCache[hash]
    if (cached) {
        const age = now - cached.timestamp
        if (cached.price !== null && age < POSITIVE_TTL) return cached.price
        if (cached.price === null && age < NULL_TTL) return null
    }

    if (pending.has(hash)) return pending.get(hash)!

    const prom = (async () => {
        const price = await fetchCheapest(hash)
        priceCache[hash] = { price, timestamp: Date.now() }
        persistCache()
        pending.delete(hash)
        return price
    })()

    pending.set(hash, prom)
    return prom
}

const PHASE_RGX = /\s*\(Phase\s*\d+\)/i
const BRACKET_RGX = /\(.*?\)/g

function buildHash(name: string, wearRaw: string, subRaw: string): string {
    const lowerSub = subRaw.toLowerCase()
    const needsPrefix: Record<string, string> = {
        'sticker': 'Sticker',
        'music kit': 'Music Kit',
        'charms': 'Charms',
        'patch': 'Patch'
    }

    const stattrak = /StatTrak/i.test(name) || /StatTrak/i.test(wearRaw)
    const souvenir = /Souvenir/i.test(name) || /Souvenir/i.test(wearRaw)

    let base = name.replace(PHASE_RGX, '').trim()
    const hasStar = base.startsWith('★')
    if (hasStar) base = base.slice(1).trim()

    base = base.replace(/^StatTrak™?\s+/i, '').replace(/^Souvenir\s+/i, '').trim()

    let cleanWear = wearRaw.replace(BRACKET_RGX, '')
    cleanWear = cleanWear.replace(/StatTrak|™|Souvenir/gi, '').replace(/[•]/g, '').trim()

    let prefix = ''
    for (const key in needsPrefix) if (lowerSub.includes(key)) { prefix = needsPrefix[key]; break }

    const parts: string[] = []
    if (hasStar) parts.push('★')
    if (souvenir) parts.push('Souvenir')
    else if (stattrak) parts.push('StatTrak™')
    if (prefix) parts.push(`${prefix} |`)
    parts.push(base)

    const finalName = parts.join(' ').replace(/\s+\|/g, ' |').trim()
    return cleanWear ? `${finalName} (${cleanWear})` : finalName
}

function getListPrice(card: Element): number {
    const txt = (card.querySelector('.price') as HTMLElement)?.textContent ?? ''
    const val = parseFloat(txt.replace(/[^0-9.]/g, '')) * 100
    return Number.isFinite(val) ? val : 0
}

async function processCard(card: HTMLElement): Promise<void> {
    if (card.dataset.priceDiffState === 'done' || card.dataset.priceDiffState === 'pending') return
    card.dataset.priceDiffState = 'pending'

    const nameEl = card.querySelector('.item-name')
    const subEl = card.querySelector('.subtext')
    if (!nameEl || !subEl) { card.dataset.priceDiffState = ''; return }

    const nameText = nameEl.textContent!.trim()
    const subText = subEl.textContent!.trim()
    if (!nameText) { card.dataset.priceDiffState = ''; return }

    const wearMatch = subText.match(/(Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)/i)
    const wear = wearMatch ? wearMatch[0] : ''

    const hash = buildHash(nameText, wear, subText)
    if (!hash) { card.dataset.priceDiffState = ''; return }

    const listPrice = getListPrice(card)
    const cheapest = await getCheapest(hash)
    if (cheapest === null) { card.dataset.priceDiffState = ''; return }

    const diff = listPrice - cheapest
    const sign = diff > 0 ? '+' : ''
    const profit = `${sign}${(diff / 100).toFixed(2)} USD`
    const pct = `${sign}${((diff / cheapest) * 100).toFixed(2)}%`

    card.querySelector('app-price-icon')?.remove()
    card.querySelector('.reference-widget-container')?.remove()
    card.querySelector('.price-diff-box')?.remove()

    const row = card.querySelector('.price-row') || card
    const box = document.createElement('div')
    box.className = 'price-diff-box'
    box.innerHTML = `${profit}<br>${pct}`
    box.style.background = diff <= 0 ? '#24a617' : '#900d0d'
    row.appendChild(box)

    card.dataset.priceDiffState = 'done'
}

function ensureStyle() {
    if (document.getElementById('price-diff-style')) return
    const style = document.createElement('style')
    style.id = 'price-diff-style'
    style.textContent = `.price-diff-box{margin-top:4px;padding:2px 6px;font-size:12px;font-weight:500;color:#fff;border-radius:6px;display:inline-block;text-align:center}`
    document.head.appendChild(style)
}

chrome.storage.sync.get('showPriceDiff', (res: { showPriceDiff?: boolean }) => {
    if (res.showPriceDiff === false) return
    ensureStyle()

    const scan = () => document.querySelectorAll('item-card').forEach(el => processCard(el as HTMLElement))
    scan()
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true })
})
})();