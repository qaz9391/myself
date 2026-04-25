<script lang="ts">
    import { onMount } from 'svelte';

    let { onSelectCoin }: { onSelectCoin?: (coin: { binanceSymbol: string; name: string; id: string }) => void } = $props();

    let activeTab = $state<'1h' | '4h' | '1d'>('4h');
    let alerts1h = $state<any[]>([]);
    let alerts4h = $state<any[]>([]);
    let alerts1d = $state<any[]>([]);
    let loading = $state(true);

    let currentAlerts = $derived(
        activeTab === '1h' ? alerts1h : activeTab === '4h' ? alerts4h : alerts1d
    );

    async function loadAlerts(timeframe: string) {
        try {
            const res = await fetch(`/api/squeeze?timeframe=${timeframe}`);
            return await res.json();
        } catch {
            return [];
        }
    }

    onMount(async () => {
        const [r1h, r4h, r1d] = await Promise.all([
            loadAlerts('1h'),
            loadAlerts('4h'),
            loadAlerts('1d'),
        ]);
        alerts1h = r1h;
        alerts4h = r4h;
        alerts1d = r1d;
        loading = false;
    });
</script>

<div class="squeeze-panel" id="squeeze-alert">
    <h3 class="panel-title">
        <span class="pulse-dot"></span>
        波動預警
    </h3>

    <div class="tab-row">
        <button
            class="tab-btn"
            class:active={activeTab === '1h'}
            onclick={() => activeTab = '1h'}
        >
            1H
        </button>
        <button
            class="tab-btn"
            class:active={activeTab === '4h'}
            onclick={() => activeTab = '4h'}
        >
            4H
        </button>
        <button
            class="tab-btn"
            class:active={activeTab === '1d'}
            onclick={() => activeTab = '1d'}
        >
            1D
        </button>
    </div>

    {#if loading}
        <div class="loading-items">
            {#each [1,2,3] as _}
                <div class="skeleton-row"></div>
            {/each}
        </div>
    {:else if currentAlerts.length === 0}
        <div class="empty-state">
            <span class="empty-icon">✅</span>
            <span>目前無擠壓預警</span>
        </div>
    {:else}
        <div class="alert-list">
            {#each currentAlerts as alert}
                <button
                    class="alert-row"
                    onclick={() => onSelectCoin?.({
                        binanceSymbol: alert.binanceSymbol,
                        name: alert.symbol,
                        id: alert.binanceSymbol?.replace('USDT', '')?.toLowerCase() || '',
                    })}
                >
                    <div class="alert-indicator"></div>
                    <div class="alert-info">
                        <span class="alert-symbol">{alert.symbol}</span>
                        <span class="alert-count">{alert.count} 根 K 棒</span>
                    </div>
                    <span class="alert-price">${alert.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .squeeze-panel {
        display: flex;
        flex-direction: column;
    }
    .panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9rem;
        font-weight: 600;
        margin: 0 0 10px 0;
        color: rgba(255,255,255,0.9);
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .pulse-dot {
        width: 8px;
        height: 8px;
        background: #ff9800;
        border-radius: 50%;
        animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
        0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.4); }
        50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(255, 152, 0, 0); }
    }
    .tab-row {
        display: flex;
        gap: 4px;
        background: rgba(255,255,255,0.04);
        padding: 3px;
        border-radius: 8px;
        margin-bottom: 10px;
    }
    .tab-btn {
        flex: 1;
        padding: 6px;
        background: transparent;
        border: none;
        border-radius: 6px;
        color: rgba(255,255,255,0.5);
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }
    .tab-btn:hover { color: rgba(255,255,255,0.8); }
    .tab-btn.active {
        background: rgba(255, 152, 0, 0.15);
        color: #ff9800;
    }
    .alert-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .alert-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: rgba(255, 152, 0, 0.05);
        border: 1px solid rgba(255, 152, 0, 0.1);
        border-radius: 8px;
        width: 100%;
        cursor: pointer;
        color: #fff;
        font-family: inherit;
        transition: all 0.2s;
        text-align: left;
    }
    .alert-row:hover {
        background: rgba(255, 152, 0, 0.12);
        border-color: rgba(255, 152, 0, 0.25);
        transform: translateX(2px);
    }
    .alert-indicator {
        width: 6px;
        height: 6px;
        background: #ff9800;
        border-radius: 50%;
        flex-shrink: 0;
    }
    .alert-info {
        flex: 1;
        display: flex;
        flex-direction: column;
    }
    .alert-symbol {
        font-size: 0.82rem;
        font-weight: 600;
    }
    .alert-count {
        font-size: 0.7rem;
        color: rgba(255,255,255,0.4);
    }
    .alert-price {
        font-size: 0.78rem;
        font-weight: 500;
        color: rgba(255,255,255,0.7);
    }
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 16px;
        color: rgba(255,255,255,0.3);
        font-size: 0.8rem;
    }
    .empty-icon { font-size: 1.4rem; }
    .loading-items { display: flex; flex-direction: column; gap: 6px; }
    .skeleton-row {
        height: 44px;
        background: rgba(255,255,255,0.04);
        border-radius: 8px;
        animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 1; }
    }
</style>
