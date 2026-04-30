<script lang="ts">
    let { coinId = 'bitcoin' }: { coinId?: string } = $props();

    let coin = $state<any>(null);
    let loading = $state(true);

    async function loadCoin() {
        loading = true;
        coin = null; // Clear previous state to prevent stuck data
        try {
            const res = await fetch(`/api/coin?id=${coinId}`);
            if (res.ok) {
                coin = await res.json();
            } else {
                console.warn(`CoinGecko ID not found for ${coinId}`);
            }
        } catch (e) {
            console.error('Failed to load coin:', e);
        }
        loading = false;
    }

    $effect(() => {
        if (coinId) loadCoin();
    });

    function formatNum(n: number | null | undefined): string {
        if (n == null) return '—';
        if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
        if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
        if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
        if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
        return `$${n.toFixed(2)}`;
    }

    function formatPrice(n: number | null | undefined): string {
        if (n == null) return '—';
        if (n >= 1) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        return `$${n.toPrecision(4)}`;
    }

    function formatSupply(n: number | null | undefined): string {
        if (n == null) return '—';
        if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
        if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
        return n.toLocaleString('en-US');
    }
</script>

<div class="coin-detail" id="coin-detail">
    {#if loading}
        <div class="detail-loading">
            <div class="detail-spinner"></div>
        </div>
    {:else if coin}
        <div class="detail-header">
            {#if coin.image}
                <img src={coin.image} alt={coin.name} class="detail-icon" />
            {/if}
            <div class="detail-names">
                <h3>{coin.name}</h3>
                <span class="detail-symbol">{coin.symbol?.toUpperCase()}</span>
                {#if coin.market_data?.market_cap_rank}
                    <span class="detail-rank">排名 #{coin.market_data.market_cap_rank}</span>
                {/if}
            </div>
        </div>

        <div class="price-row">
            <span class="current-price">{formatPrice(coin.market_data?.current_price)}</span>
            {#if coin.market_data?.price_change_percentage_24h != null}
                <span class="price-change" class:positive={coin.market_data.price_change_percentage_24h >= 0} class:negative={coin.market_data.price_change_percentage_24h < 0}>
                    {coin.market_data.price_change_percentage_24h >= 0 ? '+' : ''}{coin.market_data.price_change_percentage_24h.toFixed(2)}%
                </span>
            {/if}
        </div>

        <div class="stats-grid">
            <div class="stat">
                <span class="stat-label">市值</span>
                <span class="stat-value">{formatNum(coin.market_data?.market_cap)}</span>
            </div>
            <div class="stat">
                <span class="stat-label">24H 交易量</span>
                <span class="stat-value">{formatNum(coin.market_data?.total_volume)}</span>
            </div>
            <div class="stat">
                <span class="stat-label">24H 最高</span>
                <span class="stat-value">{formatPrice(coin.market_data?.high_24h)}</span>
            </div>
            <div class="stat">
                <span class="stat-label">24H 最低</span>
                <span class="stat-value">{formatPrice(coin.market_data?.low_24h)}</span>
            </div>
            <div class="stat">
                <span class="stat-label">7D 漲跌</span>
                <span class="stat-value" class:positive={coin.market_data?.price_change_percentage_7d >= 0} class:negative={coin.market_data?.price_change_percentage_7d < 0}>
                    {coin.market_data?.price_change_percentage_7d != null ? `${coin.market_data.price_change_percentage_7d >= 0 ? '+' : ''}${coin.market_data.price_change_percentage_7d.toFixed(2)}%` : '—'}
                </span>
            </div>
            <div class="stat">
                <span class="stat-label">30D 漲跌</span>
                <span class="stat-value" class:positive={coin.market_data?.price_change_percentage_30d >= 0} class:negative={coin.market_data?.price_change_percentage_30d < 0}>
                    {coin.market_data?.price_change_percentage_30d != null ? `${coin.market_data.price_change_percentage_30d >= 0 ? '+' : ''}${coin.market_data.price_change_percentage_30d.toFixed(2)}%` : '—'}
                </span>
            </div>
            <div class="stat">
                <span class="stat-label">流通量</span>
                <span class="stat-value">{formatSupply(coin.market_data?.circulating_supply)}</span>
            </div>
            <div class="stat">
                <span class="stat-label">最大供給</span>
                <span class="stat-value">{coin.market_data?.max_supply ? formatSupply(coin.market_data.max_supply) : '無上限'}</span>
            </div>
            <div class="stat">
                <span class="stat-label">ATH</span>
                <span class="stat-value">{formatPrice(coin.market_data?.ath)}</span>
            </div>
            <div class="stat">
                <span class="stat-label">距 ATH</span>
                <span class="stat-value negative">
                    {coin.market_data?.ath_change_percentage != null ? `${coin.market_data.ath_change_percentage.toFixed(2)}%` : '—'}
                </span>
            </div>
        </div>

        {#if coin.links}
            <div class="links-row">
                {#if coin.links.homepage}
                    <a href={coin.links.homepage} target="_blank" rel="noopener" class="link-chip">🌐 官網</a>
                {/if}
                {#if coin.links.twitter}
                    <a href={coin.links.twitter} target="_blank" rel="noopener" class="link-chip">𝕏 Twitter</a>
                {/if}
                {#if coin.links.reddit}
                    <a href={coin.links.reddit} target="_blank" rel="noopener" class="link-chip">🗨 Reddit</a>
                {/if}
                {#if coin.links.github}
                    <a href={coin.links.github} target="_blank" rel="noopener" class="link-chip">💻 GitHub</a>
                {/if}
            </div>
        {/if}

        {#if coin.description}
            <details class="description-section">
                <summary>關於 {coin.name}</summary>
                <p>{@html coin.description.substring(0, 500)}</p>
            </details>
        {/if}
    {:else}
        <div class="empty-state">
            <span class="empty-icon">😅</span>
            <span>暫無 <strong>{coinId.toUpperCase()}</strong> 的詳細基本面資料</span>
            <span style="font-size: 0.7rem; color: rgba(255,255,255,0.3); margin-top: 4px;">(CoinGecko 尚未收錄或 ID 不符)</span>
        </div>
    {/if}
</div>

<style>
    .empty-state {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 40px 20px; color: rgba(255,255,255,0.6); text-align: center; gap: 8px;
    }
    .empty-icon { font-size: 2rem; margin-bottom: 8px; }
    .coin-detail {
        display: flex;
        flex-direction: column;
        gap: 14px;
    }
    .detail-loading {
        display: flex;
        justify-content: center;
        padding: 30px;
    }
    .detail-spinner {
        width: 24px; height: 24px;
        border: 3px solid rgba(255,255,255,0.1);
        border-top-color: #00e676;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .detail-header {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .detail-icon {
        width: 42px; height: 42px;
        border-radius: 50%;
    }
    .detail-names {
        display: flex;
        align-items: baseline;
        gap: 8px;
        flex-wrap: wrap;
    }
    .detail-names h3 { margin: 0; font-size: 1.1rem; font-weight: 700; }
    .detail-symbol { color: rgba(255,255,255,0.4); font-size: 0.85rem; font-weight: 600; }
    .detail-rank {
        font-size: 0.7rem;
        background: rgba(0, 230, 118, 0.12);
        color: #00e676;
        padding: 2px 8px;
        border-radius: 6px;
        font-weight: 600;
    }
    .price-row {
        display: flex;
        align-items: baseline;
        gap: 12px;
    }
    .current-price {
        font-size: 1.5rem;
        font-weight: 700;
        color: #fff;
    }
    .price-change {
        font-size: 1rem;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 8px;
    }
    .positive { color: #00e676; background: rgba(0,230,118,0.1); }
    .negative { color: #ff5252; background: rgba(255,82,82,0.1); }
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
    }
    .stat {
        display: flex;
        justify-content: space-between;
        padding: 8px 10px;
        background: rgba(255,255,255,0.03);
        border-radius: 8px;
        font-size: 0.78rem;
    }
    .stat-label { color: rgba(255,255,255,0.4); }
    .stat-value { color: rgba(255,255,255,0.85); font-weight: 600; }
    .links-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }
    .link-chip {
        padding: 6px 12px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        color: rgba(255,255,255,0.7);
        text-decoration: none;
        font-size: 0.75rem;
        font-weight: 500;
        transition: all 0.2s;
    }
    .link-chip:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .description-section {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.5);
        line-height: 1.5;
    }
    .description-section summary {
        cursor: pointer;
        color: rgba(255,255,255,0.7);
        font-weight: 600;
        padding: 8px 0;
    }
    .description-section p { margin: 8px 0 0; }
</style>
