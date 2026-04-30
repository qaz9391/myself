<script lang="ts">
    import { onMount, tick } from 'svelte';
    import { AnchorEngine } from '$lib/anchorEngine';
    import { DirectionalEngine } from '$lib/directionalEngine';

    let { onSelectCoin, filterHighConsensus = false }: { 
        onSelectCoin?: (coin: any) => void,
        filterHighConsensus?: boolean
    } = $props();
    let expandedId = $state<string | null>(null);

    let pushingTg = $state(false);
    async function pushToTelegram() {
        if (pushingTg) return;
        pushingTg = true;
        try {
            const res = await fetch('/api/notify', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('Telegram 推播成功！');
            } else {
                alert('Telegram 推播失敗：' + data.message);
            }
        } catch (e: any) {
            alert('發生錯誤：' + e.message);
        } finally {
            pushingTg = false;
        }
    }

    let activeTab = $state<'1h' | '4h' | '1d'>('4h');
    let alerts1h = $state<any[]>([]);
    let alerts4h = $state<any[]>([]);
    let alerts1d = $state<any[]>([]);
    let loading = $state(true);

    let currentAlerts = $derived.by(() => {
        let base = [];
        if (activeTab === '1h') base = alerts1h;
        else if (activeTab === '4h') base = alerts4h;
        else base = alerts1d;
        
        if (filterHighConsensus) {
            return base.filter(a => a.bias && a.bias.agreementScore >= 75);
        }
        return base;
    });

    async function loadAlerts(timeframe: string) {
        try {
            const res = await fetch(`/api/squeeze?timeframe=${timeframe}`);
            return await res.json();
        } catch {
            return [];
        }
    }

    const anchorEngine = new AnchorEngine();
    let globalWhales: any = {};

    async function enrichAlerts(alerts: any[]) {
        for (let i = 0; i < alerts.length; i++) {
            const alert = alerts[i];
            if (alert.enriched) continue;
            
            // 1. Fetch Klines for Anchor
            try {
                const sym = alert.binanceSymbol;
                const [k1h, k4h, k1d] = await Promise.all([
                    fetch(`/api/kline?symbol=${sym}&interval=1h&limit=500`).then(r => r.json()),
                    fetch(`/api/kline?symbol=${sym}&interval=4h&limit=500`).then(r => r.json()),
                    fetch(`/api/kline?symbol=${sym}&interval=1d&limit=500`).then(r => r.json())
                ]);
                const zones = anchorEngine.processTimeframes({ '1h': k1h, '4h': k4h, '1d': k1d, '15m': [] }, alert.price);
                
                const supports = zones.filter(z => z.top < alert.price).sort((a,b) => b.score - a.score);
                const resists = zones.filter(z => z.bottom > alert.price).sort((a,b) => b.score - a.score);
                
                alert.nearestSupportZone = supports.length > 0 ? supports[0] : null;
                alert.nearestResistanceZone = resists.length > 0 ? resists[0] : null;
                alert.nearestSupport = alert.nearestSupportZone ? alert.nearestSupportZone.top : null;
                alert.nearestResistance = alert.nearestResistanceZone ? alert.nearestResistanceZone.bottom : null;
                
                // 2. Fetch Whale Data for WCI
                const wzones = globalWhales[sym] || [];
                const totalBuy = wzones.filter((z: any) => z.side === 'Buy').reduce((s: number, z: any) => s + (z.totalUsd || 0), 0);
                const totalSell = wzones.filter((z: any) => z.side === 'Sell').reduce((s: number, z: any) => s + (z.totalUsd || 0), 0);
                const wci = (totalBuy + totalSell > 0) ? (totalBuy - totalSell) / (totalBuy + totalSell) : 0;

                // 3. Directional Engine v4.0 Pro
                const mtfTrends = {
                    m15: k1h[k1h.length-1].close > k1h[k1h.length-10].close ? 'bullish' : 'bearish',
                    h1: k1h[k1h.length-1].close > k1h[k1h.length-24].close ? 'bullish' : 'bearish',
                    h4: k4h[k4h.length-1].close > k4h[k4h.length-10].close ? 'bullish' : 'bearish'
                };

                const bias = DirectionalEngine.calculateBias({
                    pattern: alert.pattern,
                    emaTrend: alert.emaTrend,
                    nearestSupport: alert.nearestSupport,
                    nearestResistance: alert.nearestResistance,
                    currentPrice: alert.price,
                    whaleControlIndex: wci,
                    whaleControlFlow: 0, // Injected via real-time stream later if available
                    mtfTrends
                });
                
                alert.bias = bias;
                alert.wci = wci;
                alert.enriched = true;
                
                // Trigger reactivity per item without completely rebuilding array
                alerts1h = [...alerts1h];
                alerts4h = [...alerts4h];
                alerts1d = [...alerts1d];
                
            } catch (e) {
                console.error('enrichment failed for', alert.symbol, e);
            }
        }
    }

    onMount(() => {
        const whaleListener = (e: any) => {
            globalWhales[e.detail.symbol] = e.detail.zones;
        };
        if (typeof window !== 'undefined') {
            document.addEventListener('whale_update', whaleListener);
        }

        async function init() {
            const [r1h, r4h, r1d] = await Promise.all([
                loadAlerts('1h'),
                loadAlerts('4h'),
                loadAlerts('1d'),
            ]);
            alerts1h = r1h;
            alerts4h = r4h;
            alerts1d = r1d;
            loading = false;
            
            // Background enrichment
            enrichAlerts(alerts4h);
            enrichAlerts(alerts1h);
            enrichAlerts(alerts1d);
        }
        
        init();

        return () => {
            if (typeof window !== 'undefined') document.removeEventListener('whale_update', whaleListener);
        };
    });
</script>

<div class="squeeze-panel" id="squeeze-alert">
    <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 8px;">
        <h3 class="panel-title" style="margin: 0; border: none; padding: 0;">
            <span class="pulse-dot"></span>
            波動預警
        </h3>
        <button class="tg-push-btn" onclick={pushToTelegram} disabled={pushingTg}>
            {pushingTg ? '推播中...' : '推播至 Telegram ➔'}
        </button>
    </div>

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
                {@const isExpanded = expandedId === alert.binanceSymbol}
                <div class="alert-card" class:is-expanded={isExpanded}>
                    <button class="card-clickable" 
                            onclick={() => expandedId = isExpanded ? null : alert.binanceSymbol} 
                            onkeydown={(e) => e.key === 'Enter' && (expandedId = isExpanded ? null : alert.binanceSymbol)}
                            aria-expanded={isExpanded}
                            type="button">
                        <div class="card-head">
                            <span class="card-sym">{alert.symbol}</span>
                            <span class="card-toggle-icon">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                        <div class="card-patt">
                            <span>{alert.pattern?.char || '•'} {alert.count}K橫盤 {alert.pattern?.type === 'ascending_triangle' ? '上升三角' : alert.pattern?.type === 'descending_triangle' ? '下降三角' : alert.pattern?.type === 'symmetrical_triangle' ? '對稱收斂' : alert.pattern?.type === 'rectangle' ? '箱型整理' : ''}</span>
                        </div>
                    </button>
                    
                    {#if isExpanded}
                        <div class="card-details-expanded">
                            {#if alert.bias}
                                <div class="card-consistency" class:high={alert.bias.agreementScore >= 75} class:low={alert.bias.agreementScore < 50}>
                                    訊標共振：{alert.bias.agreementLabel} ({alert.bias.agreementCount}/4)
                                </div>

                                <div class="card-bias" style="color: {alert.bias.score >= 0 ? '#00e676' : '#ff5252'}; background: {alert.bias.score >= 0 ? 'rgba(0,230,118,0.1)' : 'rgba(255,82,82,0.1)'}">
                                    方向：{alert.bias.direction} {alert.bias.score >= 0 ? '上破' : '下破'}機率 {Math.max(alert.bias.upProb, alert.bias.downProb)}%
                                </div>
                                
                                <div class="card-dist">
                                    上方最近壓力：{alert.nearestResistance ? `+${((alert.nearestResistance - alert.price)/alert.price*100).toFixed(1)}% → $${alert.nearestResistance.toLocaleString(undefined, {maximumFractionDigits: 5})} (Score ${alert.nearestResistanceZone.score})` : '無'}
                                    <br/>
                                    下方最近支撐：{alert.nearestSupport ? `-${((alert.price - alert.nearestSupport)/alert.price*100).toFixed(1)}% → $${alert.nearestSupport.toLocaleString(undefined, {maximumFractionDigits: 5})} (Score ${alert.nearestSupportZone.score})` : '無'}
                                </div>
                            {/if}

                            <div class="card-bot">
                                {#if alert.volumeAlert}
                                    <span class="vol" class:contracted={alert.volumeAlert.contracted}>
                                        成交量：{alert.volumeAlert.contracted ? `萎縮 ${alert.volumeAlert.ratioStr} ✓` : `未量縮 ✗`}
                                    </span>
                                {/if}
                                {#if alert.bias && alert.bias.whaleAction !== '不明'}
                                    <span class="whale">主力行為：{alert.bias.whaleAction}</span>
                                {/if}
                            </div>

                            <button class="select-btn" onclick={() => onSelectCoin?.(alert)}>
                                查看盤面與支撐壓力 ➔
                            </button>
                        </div>
                    {/if}
                </div>

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
        color: rgba(255,255,255,0.9);
    }
    .tg-push-btn {
        background: rgba(0, 136, 204, 0.2);
        color: #0088cc;
        border: 1px solid rgba(0, 136, 204, 0.4);
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
    }
    .tg-push-btn:hover:not(:disabled) {
        background: #0088cc;
        color: #fff;
    }
    .tg-push-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
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
        gap: 6px;
    }

    .alert-card {
        background: #111526;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        color: #fff;
        text-align: left;
        transition: transform 0.2s, border-color 0.2s;
        font-family: inherit;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    .alert-card:hover {
        border-color: rgba(255,152,0,0.3);
    }
    .alert-card.is-expanded {
        border-color: rgba(255,152,0,0.5);
        background: #161b33;
    }
    .card-clickable {
        padding: 10px 12px;
        cursor: pointer;
        background: transparent;
        border: none;
        width: 100%;
        text-align: left;
        display: block;
        color: inherit;
        font-family: inherit;
    }
    .card-head { 
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 800; 
        font-size: 0.85rem; 
    }
    .card-toggle-icon {
        font-size: 0.6rem;
        opacity: 0.5;
    }
    .card-patt { font-size: 0.72rem; color: #fbbf24; font-weight: 600; margin-top: 2px; }
    
    .card-details-expanded {
        padding: 0 12px 12px 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        animation: slideDown 0.2s ease;
    }
    @keyframes slideDown {
        from { opacity: 0; transform: translateY(-5px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .card-consistency {
        font-size: 0.72rem;
        font-weight: 700;
        color: #94a3b8;
        padding: 4px 8px;
        background: rgba(255,255,255,0.05);
        border-radius: 6px;
        margin-bottom: 4px;
    }
    .card-consistency.high { color: #facc15; background: rgba(250, 204, 21, 0.1); }
    .card-consistency.low { color: #ef4444; background: rgba(239, 68, 68, 0.1); }

    .card-bias { 
        font-size: 0.8rem; 
        font-weight: 800; 
        padding: 6px 8px; 
        border-radius: 6px;
        margin: 4px 0;
        display: inline-block;
    }
    .card-dist { font-size: 0.72rem; color: rgba(255,255,255,0.5); line-height: 1.3; }
    .card-bot { display: flex; flex-direction: column; gap: 3px; font-size: 0.7rem; margin-top: 2px; }
    
    .select-btn {
        margin-top: 8px;
        background: linear-gradient(135deg, #fbbf24, #d97706);
        border: none;
        padding: 8px;
        border-radius: 8px;
        color: #000;
        font-weight: 800;
        font-size: 0.75rem;
        cursor: pointer;
        text-align: center;
        transition: transform 0.1s;
    }
    .select-btn:hover {
        transform: scale(1.02);
    }
    .select-btn:active {
        transform: scale(0.98);
    }

    .vol { color: #ff5252; }
    .vol.contracted { color: #00e676; }
    .whale { color: #00bcd4; font-weight: 700; }

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
