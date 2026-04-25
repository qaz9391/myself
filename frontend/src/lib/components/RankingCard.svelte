<script lang="ts">
    import { onMount } from 'svelte';

    let {
        title = '排行榜',
        icon = '📊',
        type = 'hot',
        onSelectCoin
    }: {
        title?: string;
        icon?: string;
        type?: 'gainers' | 'losers' | 'hot';
        onSelectCoin?: (coin: any) => void;
    } = $props();

    let coins = $state<any[]>([]);
    let loading = $state(true);

    onMount(async () => {
        try {
            const res = await fetch(`/api/market?type=${type}`);
            const data = await res.json();
            coins = data?.slice?.(0, 10) || [];
        } catch (e) {
            console.error(`Failed to load ${type}:`, e);
        }
        loading = false;
    });

    function formatPrice(n: number | null): string {
        if (n == null) return '—';
        if (n >= 1) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (n >= 0.001) return `$${n.toFixed(4)}`;
        return `$${n.toPrecision(3)}`;
    }

    function handleImgError(e: Event) {
        const img = e.target as HTMLImageElement;
        img.style.display = 'none';
        const fallback = img.nextElementSibling as HTMLElement;
        if (fallback) fallback.style.display = 'flex';
    }
</script>

<div class="ranking-card" id="ranking-{type}">
    <h3 class="card-title">
        <span class="card-icon">{icon}</span>
        {title}
    </h3>

    {#if loading}
        <div class="loading-items">
            {#each [1,2,3,4,5] as _}
                <div class="skeleton-row"></div>
            {/each}
        </div>
    {:else}
        <div class="coin-list">
            {#each coins as coin, i}
                <button
                    class="coin-row"
                    onclick={() => onSelectCoin?.(coin)}
                >
                    <span class="rank-num">{i + 1}</span>
                    <img src={coin.image} alt={coin.symbol} class="coin-img" loading="lazy" onerror={handleImgError} />
                    <span class="coin-avatar" style="display:none">{coin.symbol?.toUpperCase()?.slice(0, 2)}</span>
                    <div class="coin-names">
                        <span class="coin-sym">{coin.symbol?.toUpperCase()}</span>
                    </div>
                    <div class="coin-price-col">
                        <span class="coin-price">{formatPrice(coin.current_price)}</span>
                        {#if coin.price_change_percentage_24h != null}
                            <span
                                class="coin-change"
                                class:up={coin.price_change_percentage_24h >= 0}
                                class:down={coin.price_change_percentage_24h < 0}
                            >
                                {coin.price_change_percentage_24h >= 0 ? '+' : ''}{coin.price_change_percentage_24h.toFixed(2)}%
                            </span>
                        {/if}
                    </div>
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .ranking-card {
        display: flex;
        flex-direction: column;
    }
    .card-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.9rem;
        font-weight: 600;
        margin: 0 0 10px 0;
        color: rgba(255,255,255,0.9);
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .card-icon { font-size: 1rem; }
    .coin-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }
    .coin-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 8px;
        background: transparent;
        border: none;
        border-radius: 8px;
        color: #fff;
        cursor: pointer;
        transition: background 0.2s;
        text-align: left;
        width: 100%;
    }
    .coin-row:hover { background: rgba(255,255,255,0.06); }
    .rank-num {
        width: 18px;
        font-size: 0.75rem;
        color: rgba(255,255,255,0.3);
        font-weight: 600;
        text-align: center;
    }
    .coin-img {
        width: 22px; height: 22px;
        border-radius: 50%;
    }
    .coin-avatar {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: rgba(255,255,255,0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.55rem;
        font-weight: 700;
        color: rgba(255,255,255,0.6);
        flex-shrink: 0;
    }
    .coin-names { flex: 1; min-width: 0; }
    .coin-sym {
        font-size: 0.8rem;
        font-weight: 600;
    }
    .coin-price-col {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
    }
    .coin-price {
        font-size: 0.78rem;
        font-weight: 500;
        color: rgba(255,255,255,0.85);
    }
    .coin-change {
        font-size: 0.7rem;
        font-weight: 600;
    }
    .coin-change.up { color: #00e676; }
    .coin-change.down { color: #ff5252; }
    .loading-items { display: flex; flex-direction: column; gap: 6px; }
    .skeleton-row {
        height: 36px;
        background: rgba(255,255,255,0.04);
        border-radius: 8px;
        animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 1; }
    }
</style>
