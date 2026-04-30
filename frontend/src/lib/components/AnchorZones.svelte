<script lang="ts">
    import { onMount } from 'svelte';
    import { AnchorEngine, type Zone } from '$lib/anchorEngine';

    let { visible = true, symbol = 'BTCUSDT', currentPrice = 0 } = $props();
    
    let zones = $state<Zone[]>([]);
    let isLoading = $state(false);
    let showWeak = $state(false);
    
    let sortedZones = $derived([...zones].sort((a: Zone, b: Zone) => {
        if (getGrade(a) === 'S' && getGrade(b) !== 'S') return -1;
        if (getGrade(b) === 'S' && getGrade(a) !== 'S') return 1;
        return Math.abs(a.top - currentPrice) - Math.abs(b.top - currentPrice);
    }));

    const engine = new AnchorEngine();

    async function fetchKlines(interval: string) {
        try {
            const res = await fetch(`/api/kline?symbol=${symbol}&interval=${interval}&limit=1000`);
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {
            console.error(`Failed to fetch ${interval} for ${symbol}`, e);
        }
        return [];
    }

    async function reloadAnchorZones() {
        if (!symbol) return;
        isLoading = true;
        
        let p = currentPrice;
        if (p <= 0) {
            try {
                const pRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol.toUpperCase()}`);
                if (pRes.ok) {
                    const priceData = await pRes.json();
                    p = parseFloat(priceData.price);
                }
            } catch (e) {}
        }
        if (p <= 0) {
            isLoading = false;
            return;
        }

        const [k15m, k1h, k4h, k1d] = await Promise.all([
            fetchKlines('15m'),
            fetchKlines('1h'),
            fetchKlines('4h'),
            fetchKlines('1d')
        ]);

        const tfData = { '15m': k15m, '1h': k1h, '4h': k4h, '1d': k1d };
        zones = engine.processTimeframes(tfData, p);
        
        // Dispatch for chart and other observers
        if (typeof document !== 'undefined') {
            document.dispatchEvent(new CustomEvent('anchor_update', {
                detail: {
                    symbol,
                    price: p,
                    zones: zones.map(z => ({
                        ...z,
                        level: getGrade(z)
                    }))
                }
            }));
        }
        
        isLoading = false;
    }

    // React to symbol changes
    $effect(() => {
        if (symbol && visible) {
            reloadAnchorZones();
        }
    });

    onMount(() => {
        const intervalId = setInterval(() => {
            if (visible) reloadAnchorZones();
        }, 300000); // 5 minutes refresh
        
        const whaleListener = (e: any) => {
            if (!visible || e.detail.symbol !== symbol) return;
            const wzones = e.detail.zones; // Whale zones
            
            // For each anchor zone, if there's a whale wall nearby (within 0.5%), display it if REAL.
            zones.forEach(az => {
                const el = document.getElementById(`whale-anchor-${az.top}`);
                if (!el) return;
                
                const mid = (az.top + az.bottom) / 2;
                const match = wzones.find((w: any) => {
                    const distCheck = Math.abs(w.top - mid) / mid <= 0.005;
                    const timeCheck = (Date.now() - (w.firstSeenMs || Date.now())) > 30000;
                    const spoofCheck = w.spoofScore < 40;
                    const reactCheck = w.reactionScore > 60;
                    return w.type === 'Wall' && distCheck && timeCheck && spoofCheck && reactCheck;
                });
                
                if (match) {
                    el.style.display = 'block';
                    const durationInMin = Math.floor((Date.now() - match.firstSeenMs) / 60000);
                    const usdM = match.totalUsd ? (match.totalUsd / 1000000).toFixed(1) : '?';
                    const confidence = match.confidence || 'LOW';
                    const persistenceStr = match.persistenceState === 'CONFIRMED' ? `已確認 ${durationInMin}分鐘` : `觀察中 ${durationInMin}分鐘`;
                    el.innerHTML = `🐋 ${match.exchange} $${usdM}M ${match.side === 'Buy' ? '買單牆' : '賣單牆'} · ${persistenceStr} · 信心 ${confidence}`;
                } else {
                    el.style.display = 'none';
                }
            });
        };
        
        if (typeof window !== 'undefined') {
            document.addEventListener('whale_update', whaleListener);
        }
        
        return () => {
            clearInterval(intervalId);
            if (typeof window !== 'undefined') document.removeEventListener('whale_update', whaleListener);
        };
    });

    function getGrade(zone: Zone): string {
        return zone.rank || 'C';
    }

    function getDistance(zone: Zone, cp: number) {
        const anchorPrice = zone.poc || (zone.top + zone.bottom) / 2;
        const pct = (anchorPrice - cp) / cp * 100;
        const sign = pct >= 0 ? "+" : "";
        const direction = pct >= 0 ? "↑ 上方" : "↓ 下方";
        return {
            pct: sign + Math.abs(pct).toFixed(2) + "%",
            direction,
            isAbove: pct >= 0,
            absPct: Math.abs(pct)
        };
    }
</script>

{#if visible}
<div class="anchor-alerts-wrap">
    <div class="header">
        <span class="pulse"></span>
        <h3>歷史市場錨點 (Anchor Engine)</h3>
        {#if isLoading}
            <span class="loading-text">掃描歷史數據中...</span>
        {/if}
        <button class="toggle-weak" onclick={() => showWeak = !showWeak}>
            {showWeak ? '隱藏弱錨點' : '顯示弱錨點(C)'}
        </button>
    </div>

    <!-- S 級強制置頂，其餘照價差排序 -->
    <div class="alerts-grid">
        {#each sortedZones as zone}
            {@const grade = getGrade(zone)}
            {#if grade !== 'C' || showWeak}
                {@const dist = getDistance(zone, currentPrice)}
                <div class="zone-box grade-{grade.toLowerCase()}" class:flashing={dist.absPct < 0.5}>
                    
                    <div class="z-top">
                        <span class="z-type" class:support={zone.top < currentPrice} class:resist={zone.bottom > currentPrice}>
                            {zone.top < currentPrice ? '支撐' : '壓力'}
                        </span>

                        <!-- Module 4: Distance -->
                        <span class="z-dist" class:close={dist.absPct < 0.5} style="color: {dist.absPct < 0.5 ? '#fbbf24' : (dist.isAbove ? '#ff5252' : '#00e676')}">
                            {dist.absPct < 0.5 ? '⚡ ' : ''}{dist.direction} {dist.pct}
                        </span>

                        <span class="z-score">[{grade}] {zone.score}</span>
                    </div>
                    
                    <div class="z-stats">
                        <div class="stat-row">
                            <span class="label">Density</span>
                            <span class="val" style="color: {zone.densityScore > 5 ? '#fbbf24' : 'inherit'}">{zone.densityScore?.toFixed(1) || 0}</span>
                        </div>
                        <div class="stat-row" title="Live Defend Reaction Score - based on recent volume and wick rejection">
                            <span class="label">Live Defend</span>
                            <span class="val" style="color: {zone.defendReactionScore > 0 ? '#ff9800' : 'inherit'}; font-weight: {zone.defendReactionScore > 0 ? 'bold' : 'normal'}">{zone.defendReactionScore || 0}</span>
                        </div>
                        <div class="stat-row">
                            <span class="label">Defend Rate</span>
                            <span class="val">{(zone.defendRate * 100).toFixed(0)}%</span>
                        </div>
                        <div class="stat-row">
                            <span class="label">Touch</span>
                            <span class="val">{zone.touchCount}</span>
                        </div>
                    </div>
                    
                    <div class="z-price-range">
                        <span class="range-top">{zone.top.toLocaleString(undefined, { maximumFractionDigits: 5 })}</span>
                        <div class="poc-area" title="Point of Control (Highest Volume Price)">
                            <span class="poc-label">POC</span>
                            <span class="poc-val">{zone.poc?.toLocaleString(undefined, { maximumFractionDigits: 5 })}</span>
                        </div>
                        <span class="range-bot">{zone.bottom.toLocaleString(undefined, { maximumFractionDigits: 5 })}</span>
                    </div>

                    <div class="z-tf">
                        {#each zone.timeframes as tf}
                            <span class="tf-badge">{tf}</span>
                        {/each}
                    </div>

                    <!-- Module 3: Whale Order Integration Placeholder -->
                    <div class="z-whale" id="whale-anchor-{zone.top}" style="display:none;"></div>
                </div>
            {/if}
        {/each}
        {#if zones.length === 0}
            <div class="empty">{isLoading ? '正在讀取超過四千根Ｋ線分析中...' : '當下價格周圍 (3%~15%) 無已確認的歷史防線'}</div>
        {/if}
    </div>
</div>
{/if}

<style>
    .anchor-alerts-wrap { padding: 12px; }
    .header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .pulse { width: 8px; height: 8px; background: #6366f1; border-radius: 50%; box-shadow: 0 0 10px #6366f1;}
    .header h3 { margin: 0; font-size: 0.95rem; font-weight: 800; flex: 1; color: #e2e8f0; }
    .loading-text { font-size: 0.75rem; color: #6366f1; font-weight: 600; animation: pulseOp 1.5s infinite; }
    .toggle-weak { background: rgba(255,255,255,0.1); border:none; margin-left: 8px; color: #aaa; font-size: 0.7rem; padding: 4px 8px; border-radius: 4px; cursor: pointer; } 
    @keyframes pulseOp { 0%, 100%{opacity:1;} 50%{opacity:0.5;} }

    .alerts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 10px;
    }

    .zone-box {
        background: #1e1b4b;
        border-radius: 12px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        border: 1px solid rgba(99, 102, 241, 0.4);
        box-shadow: 0 4px 15px rgba(99, 102, 241, 0.05);
        transition: all 0.2s;
    }
    
    /* Module 1: UI Grades */
    .zone-box.grade-s { border-color: #fbbf24; background: linear-gradient(180deg, rgba(251, 191, 36, 0.15) 0%, rgba(30, 27, 75, 1) 100%); }
    .zone-box.grade-a { border-color: #60a5fa; background: linear-gradient(180deg, rgba(96, 165, 250, 0.15) 0%, rgba(30, 27, 75, 1) 100%); }
    .zone-box.grade-b { border-color: rgba(255,255,255,0.2); transform: scale(0.98); opacity: 0.9; }
    .zone-box.grade-c { border-color: rgba(255,255,255,0.1); transform: scale(0.95); opacity: 0.6; }

    /* Module 4: Extreme Close Distance */
    .zone-box.flashing { animation: edgeAlert 1s infinite alternate; border-width: 2px !important; }
    .zone-box.flashing.grade-s, .zone-box.flashing.grade-a { border-color: #fbbf24 !important; }
    @keyframes edgeAlert {
        from { box-shadow: 0 0 5px rgba(251, 191, 36, 0.3); }
        to { box-shadow: 0 0 15px rgba(251, 191, 36, 0.8); }
    }

    .z-top { display: flex; justify-content: space-between; align-items: center; gap: 4px; }
    .z-type { 
        font-size: 0.65rem; font-weight: 800; padding: 2px 4px; 
        border-radius: 4px; background: rgba(0,0,0,0.4);
        text-transform: uppercase; letter-spacing: 1px;
    }
    .z-type.support { color: #00e676; border-left: 2px solid #00e676; }
    .z-type.resist { color: #ff5252; border-left: 2px solid #ff5252; }
    
    .z-dist { font-size: 0.7rem; font-weight: 800; flex: 1; text-align: center; }
    .z-dist.close { animation: blink 1s infinite; }
    @keyframes blink { 50% { opacity: 0.3; } }

    .z-score { font-size: 0.75rem; font-weight: 800; color: #a5b4fc; }

    .z-stats { display: flex; justify-content: space-between; margin: 2px 0; }
    .stat-row { display: flex; flex-direction: column; align-items: center; }
    .label { font-size: 0.6rem; color: rgba(255,255,255,0.4); text-transform: uppercase; }
    .val { font-size: 0.8rem; font-weight: 800; color: #fff; }

    .z-price-range {
        display: flex; flex-direction: column; align-items: center;
        background: rgba(0,0,0,0.3); border-radius: 8px; padding: 6px;
    }
    .range-top, .range-bot { font-size: 0.7rem; font-weight: 500; color: rgba(255,255,255,0.4); font-family: monospace; }
    .poc-area { 
        display: flex; align-items: center; gap: 8px; 
        padding: 2px 8px; background: rgba(99, 102, 241, 0.2); 
        border-radius: 4px; margin: 2px 0; border: 1px solid rgba(99,102,241,0.3);
    }
    .poc-label { font-size: 0.6rem; font-weight: 800; color: #fbbf24; }
    .poc-val { font-size: 0.9rem; font-weight: 800; color: #fff; font-family: monospace; }
    .range-divider { width: 40%; height: 1px; background: rgba(255,255,255,0.1); margin: 3px 0; }
    
    .z-tf { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
    .tf-badge { font-size: 0.6rem; background: rgba(99,102,241, 0.2); color: #c7d2fe; padding: 2px 4px; border-radius: 3px; font-weight: 600;}

    .z-whale { 
        margin-top: 6px; padding: 6px; background: rgba(0,0,0,0.4); 
        border: 1px solid rgba(255,255,255,0.05); border-radius: 6px;
        font-size: 0.7rem; color: #fbbf24; font-weight: 700; line-height: 1.4;
    }
    .empty { grid-column: 1/-1; padding: 40px; text-align: center; color: rgba(255,255,255,0.3); font-size: 0.85rem; font-weight: 600; }
</style>
