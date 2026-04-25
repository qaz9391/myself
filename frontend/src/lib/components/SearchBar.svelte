<script lang="ts">
    let { onSelect }: { onSelect: (coin: any) => void } = $props();

    let query = $state('');
    let results = $state<any[]>([]);
    let showDropdown = $state(false);
    let loading = $state(false);
    let debounceTimer: ReturnType<typeof setTimeout>;

    function handleInput() {
        clearTimeout(debounceTimer);
        if (query.length < 1) {
            results = [];
            showDropdown = false;
            return;
        }
        loading = true;
        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                results = await res.json();
                showDropdown = results.length > 0;
            } catch {
                results = [];
            }
            loading = false;
        }, 300);
    }

    function selectCoin(coin: any) {
        query = '';
        results = [];
        showDropdown = false;
        onSelect(coin);
    }

    function handleBlur() {
        // Delay to allow click on dropdown item
        setTimeout(() => { showDropdown = false; }, 200);
    }
</script>

<div class="search-wrapper" id="search-bar">
    <div class="search-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
    </div>
    <input
        type="text"
        bind:value={query}
        oninput={handleInput}
        onfocus={() => { if (results.length > 0) showDropdown = true; }}
        onblur={handleBlur}
        placeholder="搜尋幣種... 例如 Bitcoin, ETH, SOL"
        class="search-input"
        id="search-input"
    />
    {#if loading}
        <div class="search-spinner"></div>
    {/if}

    {#if showDropdown}
        <ul class="dropdown" id="search-dropdown">
            {#each results as coin}
                <li>
                    <button class="dropdown-item" onmousedown={() => selectCoin(coin)}>
                        <img src={coin.thumb} alt={coin.symbol} class="coin-icon" />
                        <div class="coin-info">
                            <span class="coin-name">{coin.name}</span>
                            <span class="coin-symbol">{coin.symbol?.toUpperCase()}</span>
                        </div>
                        {#if coin.market_cap_rank}
                            <span class="coin-rank">#{coin.market_cap_rank}</span>
                        {/if}
                    </button>
                </li>
            {/each}
        </ul>
    {/if}
</div>

<style>
    .search-wrapper {
        position: relative;
        width: 100%;
        max-width: 520px;
    }
    .search-icon {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        color: rgba(255,255,255,0.4);
        pointer-events: none;
        z-index: 2;
    }
    .search-input {
        width: 100%;
        padding: 12px 16px 12px 44px;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        color: #fff;
        font-size: 0.95rem;
        outline: none;
        transition: all 0.3s;
        backdrop-filter: blur(10px);
    }
    .search-input:focus {
        border-color: rgba(0, 230, 118, 0.5);
        box-shadow: 0 0 0 3px rgba(0, 230, 118, 0.1);
        background: rgba(255,255,255,0.08);
    }
    .search-input::placeholder {
        color: rgba(255,255,255,0.35);
    }
    .search-spinner {
        position: absolute;
        right: 14px;
        top: 50%;
        transform: translateY(-50%);
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255,255,255,0.2);
        border-top-color: #00e676;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
    }
    @keyframes spin {
        to { transform: translateY(-50%) rotate(360deg); }
    }
    .dropdown {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        right: 0;
        background: #1e2030;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        list-style: none;
        padding: 6px;
        margin: 0;
        max-height: 360px;
        overflow-y: auto;
        z-index: 100;
        box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    }
    .dropdown-item {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 10px 12px;
        background: transparent;
        border: none;
        border-radius: 8px;
        color: #fff;
        cursor: pointer;
        text-align: left;
        transition: background 0.2s;
    }
    .dropdown-item:hover {
        background: rgba(255,255,255,0.08);
    }
    .coin-icon {
        width: 28px;
        height: 28px;
        border-radius: 50%;
    }
    .coin-info {
        display: flex;
        flex-direction: column;
        flex: 1;
    }
    .coin-name {
        font-size: 0.9rem;
        font-weight: 500;
    }
    .coin-symbol {
        font-size: 0.75rem;
        color: rgba(255,255,255,0.5);
    }
    .coin-rank {
        font-size: 0.75rem;
        color: rgba(255,255,255,0.3);
        background: rgba(255,255,255,0.06);
        padding: 2px 8px;
        border-radius: 6px;
    }
</style>
