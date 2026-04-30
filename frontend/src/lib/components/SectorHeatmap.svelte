<script lang="ts">
    import { onMount } from 'svelte';
    import { AnchorEngine, type Zone } from '$lib/anchorEngine';
    import { DirectionalEngine } from '$lib/directionalEngine';
    import { TrapDetector, type PressureZone } from '$lib/trapDetector';

    let sectors = $state<any[]>([]);
    let loading = $state(true);
    let sortBy = $state<'change' | 'market_cap' | 'volume'>('change');
    let selectedSector = $state<any>(null);
    let sectorCoins = $state<any[]>([]);
    let sectorLoading = $state(false);
    
    // Module 5 Candidates
    let candidates = $state<any[]>([]);
    let candidatesLoading = $state(false);
    const engine = new AnchorEngine();
    
    let globalWhales: any = {};
    if (typeof window !== 'undefined') {
        document.addEventListener('whale_update', (e: any) => {
            globalWhales[e.detail.symbol] = e.detail.zones;
        });
    }

    let sortedSectors = $derived(() => {
        const arr = [...sectors];
        if (sortBy === 'change') {
            arr.sort((a, b) => Math.abs(b.market_cap_change_24h ?? 0) - Math.abs(a.market_cap_change_24h ?? 0));
        } else if (sortBy === 'market_cap') {
            arr.sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0));
        } else if (sortBy === 'volume') {
            arr.sort((a, b) => (b.volume_24h ?? 0) - (a.volume_24h ?? 0));
        }
        return arr.slice(0, 20);
    });

    onMount(async () => {
        try {
            const res = await fetch('/api/sectors');
            sectors = await res.json();
        } catch (e) {
            console.error('Failed to load sectors:', e);
        }
        loading = false;
    });

    async function fetchKlines(symbol: string, interval: string) {
        try {
            const res = await fetch(`/api/kline?symbol=${symbol}&interval=${interval}&limit=1000`);
            if (res.ok) return await res.json();
        } catch {}
        return [];
    }

    async function selectSector(sector: any) {
        if (selectedSector?.id === sector.id) {
            selectedSector = null;
            sectorCoins = [];
            candidates = [];
            return;
        }
        selectedSector = sector;
        sectorLoading = true;
        candidatesLoading = true;
        sectorCoins = [];
        candidates = [];

        try {
            const res = await fetch(`/api/sector-coins?category=${encodeURIComponent(sector.id)}`);
            const data = await res.json();
            sectorCoins = Array.isArray(data) ? data : [];
            
            // --- Module 5: Bridging ---
            // 1. Fetch Squeeze info
            const sqzRes = await fetch('/api/squeeze?timeframe=4h');
            const sqzData = await sqzRes.json();
            
            // 2. Pre-filter by Squeeze conditions (>= 20 bars & volume contracted)
            const preFiltered = sectorCoins.filter(coin => {
                const sym = (coin.symbol + 'USDT').toUpperCase();
                const sqz = sqzData.find((s:any) => s.binanceSymbol === sym);
                if (!sqz) return false;
                coin.sqz = sqz;
                return sqz.count >= 20 && sqz.volumeAlert?.contracted;
            });

            // 3. Lazy evaluate Anchor Engine for survivors
            const finalCandidates = [];
            for (const coin of preFiltered) {
                const sym = (coin.symbol + 'USDT').toUpperCase();
                const p = coin.current_price;
                const [k15m, k1h, k4h, k1d] = await Promise.all([
                    fetchKlines(sym, '15m'), fetchKlines(sym, '1h'), 
                    fetchKlines(sym, '4h'), fetchKlines(sym, '1d')
                ]);
                const zones = engine.processTimeframes({ '15m': k15m, '1h': k1h, '4h': k4h, '1d': k1d }, p);
                
                // Conditions: Score >= 70, Support, Distance 1% ~ 8%
                const qualifyingAnchors = zones.filter(z => {
                    if (z.top >= p) return false; // Must be support (below price)
                    if (z.score < 70) return false;
                    const pct = (p - z.top) / p * 100; // Positive distance
                    return pct >= 1.0 && pct <= 8.0;
                });
                
                if (qualifyingAnchors.length > 0) {
                    const bestAnchor = qualifyingAnchors.sort((a,b)=>b.score - a.score)[0];
                    const distPct = (p - bestAnchor.top) / p * 100;
                    
                    // --- NEW: Directional & Trap logic ---
                    const wzones = globalWhales[sym] || [];
                    const totalBuy = wzones.filter((z: any) => z.side === 'Buy').reduce((s: number, z: any) => s + (z.totalUsd || 0), 0);
                    const totalSell = wzones.filter((z: any) => z.side === 'Sell').reduce((s: number, z: any) => s + (z.totalUsd || 0), 0);
                    const wci = (totalBuy + totalSell > 0) ? (totalBuy - totalSell) / (totalBuy + totalSell) : 0;

                    const bias = DirectionalEngine.calculateBias({
                        pattern: coin.sqz.pattern,
                        emaTrend: coin.sqz.emaTrend,
                        nearestSupport: bestAnchor.top,
                        nearestResistance: zones.find(z => z.bottom > p)?.bottom || null,
                        currentPrice: p,
                        whaleControlIndex: wci,
                        whaleControlFlow: (totalBuy - totalSell) > 0 ? 1 : -1
                    });

                    const pressureZones = TrapDetector.findLiquidityPressureZones(p, zones, k1h); // Use 1h for pressure

                    // Score Candidate
                    const anchorScoreVal = bestAnchor.score * 0.40;
                    const consolVal = Math.min(coin.sqz.count / 80 * 100, 100) * 0.30;
                    const distScore = distPct <= 3 ? 100 : Math.max(0, 100 - (distPct - 3) * 20);
                    const distVal = distScore * 0.20;
                    const volRatio = coin.sqz.volumeAlert.ratio / 100;
                    const volVal = (volRatio < 1 ? (1 - volRatio) * 100 : 0) * 0.10;
                    
                    coin.candidateScore = Math.round(anchorScoreVal + consolVal + distVal + volVal);
                    coin.bestAnchor = bestAnchor;
                    coin.distPct = distPct;
                    coin.bias = bias;
                    coin.pressureZones = pressureZones;
                    coin.wci = wci; // For AI
                    
                    // Advice Text (Fallback)
                    const topPressure = pressureZones.find(pz => pz.type === '上方');
                    const botPressure = pressureZones.find(pz => pz.type === '下方');
                    
                    if (bias.upProb >= 60) {
                        coin.advice = `多單建議：$${bestAnchor.top.toPrecision(4)} 附近分批掛單`;
                        if (topPressure) coin.advice += `，目標看向 $${topPressure.price.toPrecision(4)} (${topPressure.reason})`;
                    } else if (bias.downProb >= 60) {
                        coin.advice = `空單建議：靠近壓力位尋求賣點`;
                        if (botPressure) coin.advice += `，先行觀望下方 $${botPressure.price.toPrecision(4)} (${botPressure.reason})`;
                    } else {
                        coin.advice = `建議：雙向博弈中，等待蓄力突破 🐋`;
                    }

                    finalCandidates.push(coin);
                }
            }
            
            candidates = finalCandidates.sort((a,b) => b.candidateScore - a.candidateScore);

        } catch (e) {
            console.error(e);
            sectorCoins = [];
            candidates = [];
        }
        sectorLoading = false;
        candidatesLoading = false;
    }

    function getColor(change: number | null): string {
        if (change == null) return 'rgba(255,255,255,0.1)';
        if (change > 5) return 'rgba(0, 200, 83, 0.6)';
        if (change > 2) return 'rgba(0, 200, 83, 0.35)';
        if (change > 0) return 'rgba(0, 200, 83, 0.15)';
        if (change > -2) return 'rgba(255, 82, 82, 0.15)';
        if (change > -5) return 'rgba(255, 82, 82, 0.35)';
        return 'rgba(255, 82, 82, 0.6)';
    }

    function getTextColor(change: number | null): string {
        if (change == null) return 'rgba(255,255,255,0.5)';
        return change >= 0 ? '#4cff91' : '#ff6b6b';
    }

    function formatMarketCap(n: number | null): string {
        if (n == null) return '—';
        if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
        if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
        if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
        return `$${n.toFixed(0)}`;
    }

    function formatPrice(n: number | null): string {
        if (n == null) return '—';
        if (n >= 1) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (n >= 0.001) return `$${n.toFixed(4)}`;
        return `$${n.toPrecision(3)}`;
    }

    // Draw sparkline on a canvas
    function drawSparkline(canvas: HTMLCanvasElement, prices: number[], color: string) {
        if (!canvas || !prices?.length) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = canvas.width = canvas.offsetWidth * 2;
        const h = canvas.height = canvas.offsetHeight * 2;
        ctx.clearRect(0, 0, w, h);

        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min || 1;

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        for (let i = 0; i < prices.length; i++) {
            const x = (i / (prices.length - 1)) * w;
            const y = h - ((prices[i] - min) / range) * h * 0.85 - h * 0.075;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Gradient fill
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, color.replace(')', ', 0.15)').replace('rgb', 'rgba'));
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fill();
    }

    // Bind sparkline drawing after data loads
    function sparklineAction(node: HTMLCanvasElement, params: { prices: number[]; color: string }) {
        drawSparkline(node, params.prices, params.color);
        return {
            update(p: { prices: number[]; color: string }) {
                drawSparkline(node, p.prices, p.color);
            }
        };
    }
    async function getAIAdvice(coin: any) {
        if (coin.aiAdvice) return;
        coin.aiLoading = true;
        try {
            const sym = (coin.symbol + 'USDT').toUpperCase();
            const res = await fetch('/api/ai-advice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: sym,
                    price: coin.current_price,
                    anchor: coin.bestAnchor,
                    squeeze: coin.sqz,
                    wci: coin.wci,
                    bias: coin.bias
                })
            });
            const data = await res.json();
            coin.aiAdvice = data.advice;
        } catch (e) {
            coin.aiAdvice = 'AI 分析失敗，請檢查網路。';
        }
        coin.aiLoading = false;
        candidates = [...candidates]; // Trigger reactivity
    }
</script>

<div class="sector-heatmap" id="sector-heatmap">
    <div class="heatmap-header">
        <h3 class="heatmap-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            熱門板塊漲幅比較
        </h3>
        <div class="sort-btns">
            <button class="sort-btn" class:active={sortBy === 'change'} onclick={() => sortBy = 'change'}>漲幅</button>
            <button class="sort-btn" class:active={sortBy === 'market_cap'} onclick={() => sortBy = 'market_cap'}>市值</button>
            <button class="sort-btn" class:active={sortBy === 'volume'} onclick={() => sortBy = 'volume'}>交易量</button>
        </div>
    </div>

    {#if loading}
        <div class="loading-grid">
            {#each Array(12) as _}
                <div class="skeleton-block"></div>
            {/each}
        </div>
    {:else}
        <div class="heatmap-grid">
            {#each sortedSectors() as sector}
                <button
                    class="sector-block"
                    class:selected={selectedSector?.id === sector.id}
                    style="background: {getColor(sector.market_cap_change_24h)}"
                    onclick={() => selectSector(sector)}
                >
                    <span class="sector-name">{sector.name}</span>
                    <span class="sector-change" style="color: {getTextColor(sector.market_cap_change_24h)}">
                        {sector.market_cap_change_24h != null
                            ? `${sector.market_cap_change_24h >= 0 ? '+' : ''}${sector.market_cap_change_24h.toFixed(2)}%`
                            : '—'}
                    </span>
                    <span class="sector-cap">{formatMarketCap(sector.market_cap)}</span>

                    {#if sector.top_3_coins?.length > 0}
                        <div class="sector-coins-preview">
                            {#each sector.top_3_coins as coinImg}
                                <img src={coinImg} alt="" class="top-coin-img" />
                            {/each}
                        </div>
                    {/if}
                </button>
            {/each}
        </div>

        <!-- Sector Detail Panel -->
        {#if selectedSector}
            <div class="sector-detail-panel">
                <div class="detail-header-row">
                    <h4 class="detail-title">
                        {selectedSector.name}
                        <span class="detail-change" style="color: {getTextColor(selectedSector.market_cap_change_24h)}">
                            {selectedSector.market_cap_change_24h != null
                                ? `${selectedSector.market_cap_change_24h >= 0 ? '+' : ''}${selectedSector.market_cap_change_24h.toFixed(2)}%`
                                : ''}
                        </span>
                    </h4>
                    <button class="close-btn" onclick={() => { selectedSector = null; sectorCoins = []; }}>✕</button>
                </div>

                {#if sectorLoading}
                    <div class="sector-loading">
                        <div class="sector-spinner"></div>
                        <span>載入板塊幣種...</span>
                    </div>
                {:else if sectorCoins.length === 0}
                    <div class="sector-loading">
                        <span>暫無該板塊幣種資料</span>
                    </div>
                {:else}
                    <!-- Module 5: Candidates Bridging UI -->
                    {#if candidatesLoading}
                        <div class="bridge-loading">
                            <span class="bridge-spinner"></span> 分析技術候選幣種中...
                        </div>
                    {:else if candidates.length > 0}
                        <div class="candidates-container">
                            <h5 class="section-label" style="color:#fbbf24;">⚡ 交易候選名單 (滿足 3 大條件)</h5>
                            <div class="candidates-grid">
                            {#each candidates as c}
                                <div class="candidate-card">
                                    <div class="c-head">
                                        <img src={c.image} alt={c.symbol} class="c-icon" />
                                        <div class="c-names">
                                            <span class="c-name">{c.name}</span>
                                            <span class="c-price">${c.current_price.toPrecision(4)} <span style="color:{c.price_change_percentage_24h>=0?'#00e676':'#ff5252'}">{c.price_change_percentage_24h>=0?'+':''}{c.price_change_percentage_24h.toFixed(2)}%</span></span>
                                        </div>
                                        <div class="c-score-badge">{c.candidateScore} 分</div>
                                    </div>
                                    <div class="c-stats">
                                        {#if c.bias}
                                            <div class="c-stat-row">
                                                <span style="color:#fff; font-weight:700;">方向預測</span>
                                                <span style="color: {c.bias.score >= 0 ? '#00e676' : '#ff5252'}">{c.bias.direction} {c.bias.score >=0 ? '上破' : '下破'}機率 {Math.max(c.bias.upProb, c.bias.downProb)}%</span>
                                            </div>
                                        {/if}
                                        <div class="c-stat-row">
                                            <span>最近支撐</span>
                                            <span style="color:#00e676">${c.bestAnchor.top.toPrecision(4)} (-{c.distPct.toFixed(2)}%) · Score {c.bestAnchor.score}</span>
                                        </div>
                                        <div class="c-stat-row">
                                            <span>橫盤蓄力</span>
                                            <span style="color:#fbbf24">{c.sqz.count} 根 K 棒 {c.sqz.pattern?.char} {c.sqz.pattern?.type === 'ascending_triangle' ? '上升三角' : c.sqz.pattern?.type === 'descending_triangle' ? '下降三角' : c.sqz.pattern?.type === 'symmetrical_triangle' ? '對稱收斂' : '收斂中'}</span>
                                        </div>
                                        <div class="c-stat-row">
                                            <span>成交量</span>
                                            <span style="color:#00e676">萎縮 {c.sqz.volumeAlert?.ratio.toFixed(0)}%</span>
                                        </div>
                                        {#if c.aiAdvice}
                                            <div class="c-ai-box">
                                                <div class="ai-label">🤖 Claude AI 深度顧問</div>
                                                <div class="ai-text">{c.aiAdvice}</div>
                                            </div>
                                        {:else}
                                            <button class="ai-btn" onclick={() => getAIAdvice(c)} disabled={c.aiLoading}>
                                                {c.aiLoading ? 'AI 分析中...' : '✨ 請求 AI 核心分析'}
                                            </button>
                                        {/if}

                                        {#if c.advice}
                                            <div class="c-advice-box">
                                                {c.advice}
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                            </div>
                        </div>
                    {/if}

                    <div class="sector-detail-grid">
                        <!-- Left: Top 3 sparkline charts -->
                        <div class="sparkline-section">
                            <h5 class="section-label">前 3 幣種走勢 (7D)</h5>
                            <div class="sparkline-cards">
                                {#each sectorCoins.slice(0, 3) as coin, i}
                                    <div class="sparkline-card">
                                        <div class="sparkline-info">
                                            <img src={coin.image} alt={coin.symbol} class="sparkline-icon" />
                                            <div class="sparkline-names">
                                                <span class="sparkline-name">{coin.name}</span>
                                                <span class="sparkline-sym">{coin.symbol?.toUpperCase()}</span>
                                            </div>
                                            <div class="sparkline-price-col">
                                                <span class="sparkline-price">{formatPrice(coin.current_price)}</span>
                                                {#if coin.price_change_percentage_24h != null}
                                                    <span class="sparkline-pct" style="color: {coin.price_change_percentage_24h >= 0 ? '#4cff91' : '#ff6b6b'}">
                                                        {coin.price_change_percentage_24h >= 0 ? '+' : ''}{coin.price_change_percentage_24h.toFixed(2)}%
                                                    </span>
                                                {/if}
                                            </div>
                                        </div>
                                        {#if coin.sparkline_in_7d?.length > 0}
                                            <canvas
                                                class="sparkline-canvas"
                                                use:sparklineAction={{
                                                    prices: coin.sparkline_in_7d,
                                                    color: (coin.price_change_percentage_24h ?? 0) >= 0 ? '#00e676' : '#ff5252'
                                                }}
                                            ></canvas>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        </div>

                        <!-- Right: Top 10 ranking -->
                        <div class="ranking-section">
                            <h5 class="section-label">板塊漲幅 Top 10</h5>
                            <div class="sector-ranking">
                                {#each sectorCoins.slice(0, 10) as coin, i}
                                    <div class="sector-rank-row">
                                        <span class="rank-idx">{i + 1}</span>
                                        <img src={coin.image} alt={coin.symbol} class="rank-icon" />
                                        <div class="rank-info">
                                            <span class="rank-name">{coin.name}</span>
                                            <span class="rank-sym">{coin.symbol?.toUpperCase()}</span>
                                        </div>
                                        <span class="rank-price">{formatPrice(coin.current_price)}</span>
                                        <span
                                            class="rank-change"
                                            style="color: {(coin.price_change_percentage_24h ?? 0) >= 0 ? '#4cff91' : '#ff6b6b'}"
                                        >
                                            {coin.price_change_percentage_24h != null
                                                ? `${coin.price_change_percentage_24h >= 0 ? '+' : ''}${coin.price_change_percentage_24h.toFixed(2)}%`
                                                : '—'}
                                        </span>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    {/if}
</div>

<style>
    .sector-heatmap {
        width: 100%;
    }
    .heatmap-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
        flex-wrap: wrap;
        gap: 8px;
    }
    .heatmap-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.95rem;
        font-weight: 600;
        margin: 0;
        color: rgba(255,255,255,0.9);
    }
    .sort-btns {
        display: flex;
        gap: 4px;
        background: rgba(255,255,255,0.04);
        padding: 3px;
        border-radius: 8px;
    }
    .sort-btn {
        padding: 5px 12px;
        background: transparent;
        border: none;
        border-radius: 6px;
        color: rgba(255,255,255,0.5);
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }
    .sort-btn:hover { color: rgba(255,255,255,0.8); }
    .sort-btn.active {
        background: rgba(0, 230, 118, 0.15);
        color: #00e676;
    }
    .heatmap-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 6px;
    }
    .sector-block {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 14px 10px;
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.3s;
        min-height: 80px;
        text-align: center;
        color: #fff;
        font-family: inherit;
    }
    .sector-block:hover {
        transform: translateY(-2px);
        border-color: rgba(255,255,255,0.15);
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .sector-block.selected {
        border-color: #00e676;
        box-shadow: 0 0 0 2px rgba(0, 230, 118, 0.2);
    }
    .sector-name {
        font-size: 0.78rem;
        font-weight: 600;
        color: rgba(255,255,255,0.9);
        margin-bottom: 4px;
        line-height: 1.2;
    }
    .sector-change {
        font-size: 1rem;
        font-weight: 700;
    }
    .sector-cap {
        font-size: 0.68rem;
        color: rgba(255,255,255,0.4);
        margin-top: 2px;
    }
    .sector-coins-preview {
        display: flex;
        gap: 4px;
        margin-top: 6px;
    }
    .top-coin-img {
        width: 18px;
        height: 18px;
        border-radius: 50%;
    }

    /* ---- Sector Detail Panel ---- */
    .sector-detail-panel {
        margin-top: 16px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px;
        padding: 20px;
        animation: panelSlide 0.3s ease;
    }
    .c-advice-box {
        margin-top: 8px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 8px;
        border-radius: 6px;
        font-size: 0.72rem;
        color: #aaa;
        line-height: 1.4;
    }
    .c-ai-box {
        margin-top: 10px;
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(30, 27, 75, 0.4) 100%);
        border: 1px solid rgba(99, 102, 241, 0.4);
        padding: 10px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    }
    .ai-label { font-size: 0.65rem; color: #a5b4fc; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 1px; }
    .ai-text { font-size: 0.78rem; color: #fff; line-height: 1.5; font-style: italic; }
    .ai-btn {
        margin-top: 10px;
        background: rgba(99, 102, 241, 0.15);
        border: 1px solid rgba(99, 102, 241, 0.4);
        color: #a5b4fc;
        padding: 6px;
        border-radius: 6px;
        font-size: 0.72rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
    }
    .ai-btn:hover { background: rgba(99, 102, 241, 0.25); border-color: #a5b4fc; }
    .ai-btn:disabled { opacity: 0.5; cursor: wait; }

    /* Original animation */
    @keyframes panelSlide {
        from { opacity: 0; transform: translateY(-10px); }
        to   { opacity: 1; transform: translateY(0); }
    }
    .detail-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .detail-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .detail-change {
        font-size: 0.85rem;
        font-weight: 600;
    }
    .close-btn {
        background: rgba(255,255,255,0.06);
        border: none;
        border-radius: 8px;
        color: rgba(255,255,255,0.5);
        width: 28px;
        height: 28px;
        cursor: pointer;
        font-size: 0.8rem;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }
    .close-btn:hover {
        background: rgba(255,255,255,0.12);
        color: #fff;
    }

    .sector-detail-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
    }

    .section-label {
        margin: 0 0 12px 0;
        font-size: 0.82rem;
        font-weight: 600;
        color: rgba(255,255,255,0.6);
    }

    /* Sparkline cards */
    .sparkline-cards {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .sparkline-card {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 10px;
        padding: 12px;
    }
    .sparkline-info {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
    }
    .sparkline-icon {
        width: 28px;
        height: 28px;
        border-radius: 50%;
    }
    .sparkline-names {
        flex: 1;
        display: flex;
        flex-direction: column;
    }
    .sparkline-name {
        font-size: 0.85rem;
        font-weight: 600;
    }
    .sparkline-sym {
        font-size: 0.7rem;
        color: rgba(255,255,255,0.4);
    }
    .sparkline-price-col {
        text-align: right;
    }
    .sparkline-price {
        font-size: 0.85rem;
        font-weight: 600;
        display: block;
    }
    .sparkline-pct {
        font-size: 0.72rem;
        font-weight: 600;
    }
    .sparkline-canvas {
        width: 100%;
        height: 50px;
        display: block;
    }

    /* Ranking section */
    .sector-ranking {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .sector-rank-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 8px;
        border-radius: 8px;
        transition: background 0.2s;
    }
    .sector-rank-row:hover {
        background: rgba(255,255,255,0.04);
    }
    .rank-idx {
        width: 18px;
        text-align: center;
        font-size: 0.72rem;
        font-weight: 600;
        color: rgba(255,255,255,0.3);
    }
    .rank-icon {
        width: 22px;
        height: 22px;
        border-radius: 50%;
    }
    .rank-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
    }
    .rank-name {
        font-size: 0.8rem;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .rank-sym {
        font-size: 0.68rem;
        color: rgba(255,255,255,0.35);
    }
    .rank-price {
        font-size: 0.78rem;
        font-weight: 500;
        color: rgba(255,255,255,0.8);
    }
    .rank-change {
        font-size: 0.75rem;
        font-weight: 700;
        min-width: 65px;
        text-align: right;
    }

    .sector-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 30px;
        color: rgba(255,255,255,0.4);
        font-size: 0.85rem;
    }
    .sector-spinner {
        width: 24px; height: 24px;
        border: 3px solid rgba(255,255,255,0.1);
        border-top-color: #00e676;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .loading-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 6px;
    }
    .skeleton-block {
        height: 80px;
        background: rgba(255,255,255,0.04);
        border-radius: 10px;
        animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 1; }
    }

    /* Module 5 Candidates UI */
    .bridge-loading { font-size: 0.75rem; color: #fbbf24; display: flex; align-items: center; gap: 8px; margin-bottom: 20px; }
    .bridge-spinner { width: 14px; height: 14px; border: 2px solid rgba(251, 191, 36, 0.2); border-top-color: #fbbf24; border-radius: 50%; animation: spin 0.7s linear infinite; }
    .candidates-container { margin-bottom: 20px; background: rgba(251, 191, 36, 0.05); padding: 16px; border-radius: 12px; border: 1px solid rgba(251, 191, 36, 0.1); }
    .candidates-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
    .candidate-card { background: rgba(0,0,0,0.3); border-radius: 10px; padding: 12px; border: 1px solid rgba(255,255,255,0.05); }
    .c-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; }
    .c-icon { width: 30px; height: 30px; border-radius: 50%; }
    .c-names { flex: 1; display: flex; flex-direction: column; }
    .c-name { font-size: 0.85rem; font-weight: 700; }
    .c-price { font-size: 0.7rem; color: #aaa; }
    .c-score-badge { font-size: 0.8rem; font-weight: 800; background: #fbbf24; color: #1e1b4b; padding: 4px 8px; border-radius: 6px; }
    .c-stats { display: flex; flex-direction: column; gap: 4px; }
    .c-stat-row { display: flex; justify-content: space-between; font-size: 0.75rem; color: #aaa; }
    .c-stat-row span:last-child { font-weight: 600; }

    @media (max-width: 900px) {
        .sector-detail-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
