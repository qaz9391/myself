<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { LiquidityEngine, type ZoneData } from '$lib/liquidityEngine';
    import { r5Engine, R5Engine, type WallSignal } from '$lib/r5Engine';
    import { latencyMonitor } from '$lib/liquidityEngine';
    import { icebergDetector } from '$lib/liquidityEngine';

    let { visible = true } = $props();
    let wsBinance: WebSocket | null = null;
    let wsBybit: WebSocket | null = null;
    let wsOkx: WebSocket | null = null;
    
    // UI state
    let activeZones = $state<Record<string, ZoneData[]>>({});
    let currentPrices: Record<string, number> = {};
    const engine = new LiquidityEngine();
    let regimeLabel = $state('🔲 箱型整理'); // R5-3 regime display

    // Top 20 coins by typical perpetual volume (USDT-margined)
    const TARGET_SYMBOLS = [
        'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT',
        'BNBUSDT', 'PEPEUSDT', 'SUIUSDT', 'ADAUSDT', 'AVAXUSDT',
        'LINKUSDT', 'DOTUSDT', 'TRXUSDT', 'SHIBUSDT', 'NEARUSDT',
        'LTCUSDT', 'AAVEUSDT', 'UNIUSDT', 'CRVUSDT', 'ATOMUSDT'
    ];
    
    function getThreshold(symbol: string): number {
        if (symbol === 'BTCUSDT')  return 3_000_000;
        if (symbol === 'ETHUSDT')  return 1_500_000;
        if (symbol === 'SOLUSDT')  return 600_000;
        if (symbol === 'BNBUSDT')  return 500_000;
        if (symbol === 'XRPUSDT')  return 400_000;
        if (symbol === 'DOGEUSDT') return 300_000;
        if (symbol === 'PEPEUSDT') return 200_000;
        if (symbol === 'SUIUSDT')  return 200_000;
        if (symbol === 'ADAUSDT')  return 300_000;
        if (symbol === 'AVAXUSDT') return 300_000;
        if (symbol === 'LINKUSDT') return 250_000;
        if (symbol === 'AAVEUSDT') return 300_000;
        return 150_000; // default for mid-cap
    }

    function processDepth(exchange: string, symbol: string, bids: [string, string][], asks: [string, string][]) {
        const cp = currentPrices[symbol];
        if (!cp) return;

        const threshold = getThreshold(symbol);
        
        let processedBids = bids;
        let processedAsks = asks;

        // Module 3: OKX Contract Size Conversion
        if (exchange === 'OKX') {
            // OKX contract multipliers: contract qty → base asset qty
            const OKX_CONTRACT_SIZE: Record<string, number> = {
                BTCUSDT: 0.01, ETHUSDT: 0.1, SOLUSDT: 1, BNBUSDT: 0.1,
                XRPUSDT: 10,  DOGEUSDT: 1000, ADAUSDT: 10, AVAXUSDT: 1,
                LINKUSDT: 1, DOTUSDT: 10, LTCUSDT: 0.1, NEARUSDT: 10,
                SUIUSDT: 10, AAVEUSDT: 0.1, UNIUSDT: 1, CRVUSDT: 100,
                ATOMUSDT: 1, TRXUSDT: 1000, PEPEUSDT: 100_000, SHIBUSDT: 1_000_000
            };
            const size = OKX_CONTRACT_SIZE[symbol] ?? 1;
            processedBids = bids.map((b: any) => [b[0], (parseFloat(b[1]) * size).toString()]);
            processedAsks = asks.map((a: any) => [a[0], (parseFloat(a[1]) * size).toString()]);
        }

        engine.parseDepthUpdate(exchange, symbol, cp, processedBids, processedAsks);

        // Export Cross-market whales & WCI Flow (Module 3 + V4 Pro)
        const newZones = engine.getActiveZones(symbol, cp);
        const wciFlow = engine.getWhaleControlFlow(exchange, symbol);
        activeZones[symbol] = newZones;
        document.dispatchEvent(new CustomEvent('whale_update', { 
            detail: { symbol, zones: newZones, wciFlow } 
        }));
    }

    onMount(() => {
        // --- Connection Functions with Auto-Reconnect ---
        function connectBinance() {
            const streams = TARGET_SYMBOLS.map(s => `${s.toLowerCase()}@depth20@100ms`).join('/');
            const tickerStreams = TARGET_SYMBOLS.map(s => `${s.toLowerCase()}@ticker`).join('/');
            const tradeStreams = TARGET_SYMBOLS.map(s => `${s.toLowerCase()}@aggTrade`).join('/');
            wsBinance = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}/${tickerStreams}/${tradeStreams}`);
            wsBinance.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (!msg || !msg.data) return;
                const stream = msg.stream as string;
                const data = msg.data;
                if (stream.includes('@ticker')) {
                    currentPrices[data.s] = parseFloat(data.c);
                    if (activeZones[data.s]) activeZones[data.s] = engine.getActiveZones(data.s, parseFloat(data.c));
                }
                if (stream.includes('@aggTrade')) {
                    const usd = parseFloat(data.p) * parseFloat(data.q);
                    engine.parseTradeUpdate('BINANCE', data.s, parseFloat(data.p), usd, data.T);
                    // R5-1: calibrate time offset using matched book+trade events
                    r5Engine.timeNormalizer.recordMatch('BINANCE', data.T - 50, data.T);
                }
                if (stream.includes('@depth')) processDepth('BINANCE', data.s, data.bids || [], data.asks || []);
            };
            wsBinance.onclose = () => { latencyMonitor.record('binance', 9999); setTimeout(connectBinance, 3000); };
            wsBinance.onerror = () => wsBinance?.close();
        }

        function connectBybit() {
            wsBybit = new WebSocket('wss://stream.bybit.com/v5/public/linear');
            wsBybit.onopen = () => {
                wsBybit?.send(JSON.stringify({ op: 'subscribe', args: TARGET_SYMBOLS.map(s => `orderbook.50.${s}`) }));
            };
            wsBybit.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.topic && msg.topic.startsWith('orderbook')) {
                    const parts = msg.topic.split('.');
                    const symbol = parts[parts.length - 1];
                    if (msg.data) processDepth('BYBIT', symbol, msg.data.b || [], msg.data.a || []);
                }
            };
            wsBybit.onclose = () => { latencyMonitor.record('bybit', 9999); setTimeout(connectBybit, 3000); };
            wsBybit.onerror = () => wsBybit?.close();
        }

        function connectOkx() {
            wsOkx = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');
            let pingInterval: any;
            wsOkx.onopen = () => {
                const args = TARGET_SYMBOLS.map(s => ({ channel: 'books5', instId: `${s.replace('USDT', '-USDT')}-SWAP` }));
                wsOkx?.send(JSON.stringify({ op: 'subscribe', args }));
                
                // V4: OKX 25s Heartbeat
                pingInterval = setInterval(() => {
                    if (wsOkx?.readyState === WebSocket.OPEN) wsOkx.send('ping');
                }, 25000);
            };
            wsOkx.onmessage = (event) => {
                if (event.data === 'pong') return;
                const msg = JSON.parse(event.data);
                if (msg.arg && msg.arg.channel === 'books5' && msg.data) {
                    const symbol = msg.arg.instId.replace('-SWAP', '').replace('-', '');
                    const data = msg.data[0];
                    processDepth('OKX', symbol, data.bids || [], data.asks || []);
                }
            };
            wsOkx.onclose = () => {
                if (pingInterval) clearInterval(pingInterval);
                latencyMonitor.record('okx', 9999);
                setTimeout(connectOkx, 3000);
            };
            wsOkx.onerror = () => wsOkx?.close();
        }

        // Initialize connections
        connectBinance();
        connectBybit();
        connectOkx();

        // R5: Background regime updates
        async function updateRegimes() {
            for (const sym of TARGET_SYMBOLS) {
                try {
                    const res = await fetch(`/api/kline?symbol=${sym}&interval=4h&limit=250`);
                    if (!res.ok) continue;
                    const data = await res.json();
                    if (!data || data.length < 200) continue;
                    
                    const closes = data.map((d: any) => d.close);
                    const highs  = data.map((d: any) => d.high);
                    const lows   = data.map((d: any) => d.low);
                    
                    const ema21 = R5Engine.calcEMA(closes, 21);
                    const ema200 = R5Engine.calcEMA(closes, 200);
                    const atr14 = R5Engine.calcATR(highs, lows, closes, 14);
                    const price = closes[closes.length - 1];
                    
                    r5Engine.updateRegime(sym, price, ema21, ema200, atr14);
                } catch (e) {
                    console.error('Regime update failed for', sym, e);
                }
                // avoid rate limits
                await new Promise(r => setTimeout(r, 200));
            }
        }
        
        updateRegimes();
        const regimeInterval = setInterval(updateRegimes, 5 * 60_000); // refresh every 5 mins

        return () => {
            clearInterval(regimeInterval);
            if (wsBinance) { wsBinance.onclose = null; wsBinance.close(); }
            if (wsBybit) { wsBybit.onclose = null; wsBybit.close(); }
            if (wsOkx) { wsOkx.onclose = null; wsOkx.close(); }
        };
    });

    let allZones = $derived(Object.entries(activeZones).flatMap(([sym, zones]) => zones.map(z => ({ symbol: sym, ...z }))).sort((a,b) => b.heat - a.heat));

</script>

{#if visible}
<div class="whale-alerts-wrap">
    <div class="header">
        <span class="pulse"></span>
        <h3>實體級 流動性空間 (Entity-Level Zones)</h3>
        <span class="regime-badge">{regimeLabel}</span>
    </div>

    <div class="alerts-grid">
        {#each allZones as zone}
            {@const sig = r5Engine.evaluateWall(zone.symbol, zone.totalUsd || 0)}
            <div class="zone-box" class:wall={zone.type === 'Wall'} class:trap={zone.type === 'Trap'} class:void={zone.type === 'Void'} 
                 class:buy={zone.side === 'Buy'} class:sell={zone.side === 'Sell'}
                 style="opacity: {0.4 + (zone.heat / 100) * 0.6}">
                
                <div class="z-top">
                    <span class="z-type" class:confirmed={zone.persistenceState === 'CONFIRMED'}>
                        {#if zone.type === 'Wall'}
                            {zone.side === 'Buy' ? '支撐 (多)' : '壓力 (空)'}
                        {:else if zone.type === 'Trap'}
                            陷阱 (危)
                        {:else}
                            真空 (破)
                        {/if}
                        {#if zone.persistenceState === 'CONFIRMED'}
                            <span class="status-check">✓</span>
                        {/if}
                    </span>
                    <span class="z-confidence" class:high={zone.confidence === 'HIGH'}>
                        {zone.confidence}
                    </span>
                </div>
                
                <div class="z-mid">
                    <span class="z-sym">{zone.symbol.replace('USDT','')}</span>
                </div>
                
                <div class="z-price-range">
                    <span class="range-top">{zone.top.toLocaleString(undefined, { maximumFractionDigits: 5 })}</span>
                    <div class="range-divider"></div>
                    <span class="range-bot">{zone.bottom.toLocaleString(undefined, { maximumFractionDigits: 5 })}</span>
                </div>

                <div class="z-info-row">
                    <span class="z-usd">${((zone.totalUsd || 0) / 1e6).toFixed(1)}M</span>
                    <span class="z-verdict" class:reliable={sig.isReliable} title={sig.verdict}>
                        {sig.isReliable ? (sig.pauseProb >= 0.70 ? '🟢' : sig.pauseProb >= 0.50 ? '🟡' : '🔴') : '⚪'}
                        {(sig.pauseProb * 100).toFixed(0)}%
                    </span>
                </div>
            </div>
        {/each}
        {#if allZones.length === 0}
            <div class="empty">分析市場流動性中... 建構實體特徵碼</div>
        {/if}
    </div>
</div>
{/if}

<style>
    .whale-alerts-wrap { padding: 12px; }
    .header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .pulse { width: 8px; height: 8px; background: #00e676; border-radius: 50%; animation: blink 1.5s infinite; }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    .header h3 { margin: 0; font-size: 0.95rem; font-weight: 800; flex: 1; color: #e2e8f0; }
    .regime-badge {
        font-size: 0.7rem; font-weight: 700; padding: 3px 8px;
        background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.4);
        border-radius: 20px; color: #a5b4fc; white-space: nowrap;
    }

    .alerts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
        gap: 10px;
    }

    .zone-box {
        background: #111526;
        border-radius: 12px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        transition: transform 0.2s, opacity 0.5s;
        border: 1px solid rgba(255,255,255,0.03);
    }
    
    /* Zone Types Visualization */
    .zone-box.wall.buy {
        background: linear-gradient(180deg, rgba(0,230,118,0.15) 0%, rgba(0,230,118,0.05) 100%);
        border: 1px solid rgba(0,230,118,0.3);
        box-shadow: 0 4px 20px rgba(0,230,118,0.1);
    }
    .zone-box.wall.sell {
        background: linear-gradient(180deg, rgba(255,82,82,0.15) 0%, rgba(255,82,82,0.05) 100%);
        border: 1px solid rgba(255,82,82,0.3);
        box-shadow: 0 4px 20px rgba(255,82,82,0.1);
    }
    .zone-box.void {
        background: repeating-linear-gradient(45deg, rgba(255,255,255,0.02), rgba(255,255,255,0.02) 10px, transparent 10px, transparent 20px);
        border: 1px dashed rgba(255,255,255,0.2);
    }
    .zone-box.trap {
        background: rgba(255, 235, 59, 0.1);
        border: 1px solid rgba(255, 235, 59, 0.4);
        box-shadow: 0 0 15px rgba(255, 235, 59, 0.1);
    }

    .z-top { display: flex; justify-content: space-between; align-items: center; }
    .z-type { 
        font-size: 0.7rem; font-weight: 800; padding: 2px 6px; 
        border-radius: 4px; background: rgba(0,0,0,0.3);
        text-transform: uppercase; letter-spacing: 1px;
    }
    .trap .z-type { color: #ffeb3b; }
    .wall.buy .z-type { color: #00e676; }
    .wall.sell .z-type { color: #ff5252; }
    .void .z-type { color: #aaaaaa; }

    .z-heat { font-size: 0.65rem; font-weight: 800; color: rgba(255,255,255,0.6); }

    .z-mid { display: flex; justify-content: center; margin: 2px 0; }
    .z-sym { font-weight: 900; font-size: 1rem; color: #fff; letter-spacing: 1px; }

    .z-confidence { font-size: 0.6rem; font-weight: 800; color: rgba(255,255,255,0.4); padding: 2px 4px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); }
    .z-confidence.high { color: #fbbf24; border-color: rgba(251,191,36,0.4); background: rgba(251,191,36,0.1); }

    .z-type.confirmed { background: rgba(0, 230, 118, 0.2); }
    .status-check { margin-left: 4px; color: #00e676; font-size: 0.8rem; }

    .z-info-row { display: flex; justify-content: space-between; margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.05); }
    .z-usd { font-size: 0.72rem; font-weight: 800; color: #fff; }
    .z-duration { font-size: 0.65rem; color: rgba(255,255,255,0.4); }
    .z-verdict { font-size: 0.65rem; color: rgba(255,255,255,0.4); cursor: help; }
    .z-verdict.reliable { color: #e2e8f0; font-weight: 600; }

    .z-price-range {
        display: flex; flex-direction: column; align-items: center;
        background: rgba(0,0,0,0.2); border-radius: 8px; padding: 6px;
    }
    .range-top, .range-bot { font-size: 0.85rem; font-weight: 700; color: #fff; font-family: monospace; }
    .range-divider { width: 40%; height: 1px; background: rgba(255,255,255,0.1); margin: 3px 0; }
    
    .empty { grid-column: 1/-1; padding: 40px; text-align: center; color: rgba(255,255,255,0.3); font-size: 0.8rem; }
</style>
