<script lang="ts">
    import SearchBar from "$lib/components/SearchBar.svelte";
    import NewsPanel from "$lib/components/NewsPanel.svelte";
    import KlineChart from "$lib/components/KlineChart.svelte";
    import CoinDetail from "$lib/components/CoinDetail.svelte";
    import RankingCard from "$lib/components/RankingCard.svelte";
    import SqueezeAlert from "$lib/components/SqueezeAlert.svelte";
    import SectorHeatmap from "$lib/components/SectorHeatmap.svelte";
    import WhaleOrderBook from "$lib/components/WhaleOrderBook.svelte";
    import AnchorZones from "$lib/components/AnchorZones.svelte";
    import InfoTooltip from "$lib/components/InfoTooltip.svelte";
    import { DirectionalEngine } from "$lib/directionalEngine";

    // Map of CoinGecko coin ID -> Binance symbol
    const coinToBinance: Record<string, string> = {
        bitcoin: "BTCUSDT",
        ethereum: "ETHUSDT",
        solana: "SOLUSDT",
        binancecoin: "BNBUSDT",
        ripple: "XRPUSDT",
        dogecoin: "DOGEUSDT",
        cardano: "ADAUSDT",
        "avalanche-2": "AVAXUSDT",
        polkadot: "DOTUSDT",
        "matic-network": "MATICUSDT",
        chainlink: "LINKUSDT",
        litecoin: "LTCUSDT",
        cosmos: "ATOMUSDT",
        uniswap: "UNIUSDT",
        near: "NEARUSDT",
        aptos: "APTUSDT",
        optimism: "OPUSDT",
        arbitrum: "ARBUSDT",
        sui: "SUIUSDT",
        sei: "SEIUSDT",
        "shiba-inu": "SHIBUSDT",
        pepe: "PEPEUSDT",
        tron: "TRXUSDT",
    };

    let selectedCoinId = $state("bitcoin");
    let selectedCoinName = $state("Bitcoin");
    let selectedBinanceSymbol = $state("BTCUSDT");
    let detailOpen = $state(false);

    // Dashboard visibility controls
    let showNews = $state(true);
    let showHot = $state(true);
    let showGainers = $state(true);
    let showLosers = $state(true);
    let showSqueeze = $state(true);
    let showAlerts = $state(true);
    let showAnchor = $state(true);
    let activeZones = $state<Record<string, any>>({});
    let currentPrices = $state<Record<string, number>>({});
    let showHeatmap = $state(true);
    let settingsOpen = $state(false);

    let activeView = $state('dashboard');
    let sidebarOpen = $state(false);

    // v3.0 logic
    let filterHighConsensus = $state(false);
    let selectedAnchors = $state<any[]>([]);
    let selectedWhales = $state<any[]>([]);

    // Dynamic right panel visibility
    let showRightPanel = $derived(
        showHot || showGainers || showLosers || showSqueeze,
    );

    function handleCoinSelect(coin: any) {
        // From search dropdown (CoinGecko search result)
        selectedCoinId = coin.id;
        selectedCoinName = coin.name;
        selectedBinanceSymbol =
            coinToBinance[coin.id] || `${coin.symbol?.toUpperCase()}USDT`;
    }

    function handleRankingCoinSelect(coin: any) {
        // From ranking cards — may be CoinGecko (hot) or Binance (gainers/losers)
        if (coin.binanceSymbol) {
            // Binance-sourced data
            selectedBinanceSymbol = coin.binanceSymbol;
            selectedCoinName = coin.binanceSymbol.replace("USDT", "");
            const key = coin.binanceSymbol.replace("USDT", "").toLowerCase();
            selectedCoinId = binanceToCoinId[key] || key;
        } else {
            // CoinGecko-sourced data
            selectedCoinId = coin.id;
            selectedCoinName = coin.name;
            selectedBinanceSymbol =
                coinToBinance[coin.id] || `${coin.symbol?.toUpperCase()}USDT`;
        }
    }

    // Reverse map: Binance symbol (without USDT) -> CoinGecko ID
    const binanceToCoinId: Record<string, string> = Object.fromEntries(
        Object.entries(coinToBinance).map(([cgId, bSymbol]) => [
            bSymbol.replace("USDT", "").toLowerCase(),
            cgId,
        ]),
    );

    let selectedBias = $state<any>(null);

    function handleSqueezeSelect(coin: any) {
        const sym = coin.binanceSymbol || "";
        selectedBinanceSymbol = sym;
        selectedCoinName = coin.name || sym.replace("USDT", "");
        selectedBias = coin.bias;

        const key = sym.replace("USDT", "").toLowerCase();
        selectedCoinId = binanceToCoinId[key] || coin.id || key;
    }

    // Trade Suggestion Engine v4.0 Pro
    let tradeSuggestion = $derived.by(() => {
        if (!selectedBias) return null;
        
        return {
            type: selectedBias.score > 0 ? '多單建議' : '空單建議',
            tradeStatus: selectedBias.tradeStatus,
            setup: selectedBias.setup,
            reason: `${selectedBias.agreementLabel} | ${selectedBias.whaleAction}`
        };
    });

    import { onMount } from 'svelte';
    onMount(() => {
        const whaleListener = (e: any) => {
            if (e.detail.symbol === selectedBinanceSymbol) {
                selectedWhales = e.detail.zones;
                // V4 Pro: Update Bias with real-time Flow
                if (selectedBias) {
                    selectedBias = DirectionalEngine.calculateBias({
                        ...selectedBias.params, // Need to store params in bias
                        whaleControlFlow: e.detail.wciFlow || 0
                    });
                }
            }
        };
        const anchorListener = (e: any) => {
            if (e.detail.symbol === selectedBinanceSymbol) {
                selectedAnchors = e.detail.zones;
            }
        };
        document.addEventListener('whale_update', whaleListener);
        document.addEventListener('anchor_update', anchorListener);

        // Fetch Marquee News
        fetch('/api/news?limit=10')
            .then(res => res.json())
            .then(data => {
                marqueeNews = data.filter((n: any) => n.isBreaking).slice(0, 5);
                if (marqueeNews.length === 0) marqueeNews = data.slice(0, 5); // Fallback
            })
            .catch(err => console.log('Marquee fetch failed:', err));

        return () => {
            document.removeEventListener('whale_update', whaleListener);
            document.removeEventListener('anchor_update', anchorListener);
        };
    });

    let marqueeNews = $state<any[]>([]);
</script>

<svelte:head>
    <title>TradingMonitor — 加密貨幣即時儀表板</title>
    <meta
        name="description"
        content="即時監控加密貨幣市場：K線圖表、漲跌幅排行、板塊分析、波動預警一站掌握"
    />
</svelte:head>

<div class="app-layout">
    <div class="sidebar-overlay" class:open={sidebarOpen} onclick={() => sidebarOpen = false} onkeydown={(e) => e.key === 'Escape' && (sidebarOpen = false)} role="button" tabindex="0"></div>
    
    <div class="main-content">
        {#if marqueeNews.length > 0}
            <div class="news-marquee">
                <div class="marquee-content">
                    {#each marqueeNews as news}
                        <span class="marquee-item">
                            <span class="m-source">[{news.source}]</span>
                            <a href={news.url} target="_blank" rel="noopener">{news.title}</a>
                        </span>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Header -->
        <header class="dash-header">
            <button class="hamburger-btn" onclick={() => sidebarOpen = !sidebarOpen} aria-label="Menu">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
            </button>
            <div class="logo-area desktop-logo">
                <div class="logo-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00e676" stroke-width="2.5">
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
                    </svg>
                </div>
                <span class="logo-text">TradingMonitor</span>
            </div>
            <div class="search-area">
                <SearchBar onSelect={handleCoinSelect} />
            </div>
            <div class="header-actions">
                <div class="header-badge">
                    <span class="live-dot"></span>
                    <span>LIVE</span>
                </div>
            </div>
        </header>

        <!-- Dynamic Main Area -->
        <main class="view-container">
            {#if activeView === 'dashboard'}
                <div class="main-grid">
                    <section class="center-panel">
                        <div class="glass-card chart-card">
                            <KlineChart symbol={selectedBinanceSymbol} coinName={selectedCoinName} anchors={selectedAnchors} whales={selectedWhales} />
                        </div>

                        <div class="glass-card detail-toggle-card">
                            <button class="toggle-btn" onclick={() => (detailOpen = !detailOpen)}>
                                <span class="toggle-icon" class:open={detailOpen}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </span>
                                <span>{detailOpen ? "收起幣種基本資料 (手動點閱)" : "展開幣種基本資料 (手動點閱)"}</span>
                            </button>
                            {#if detailOpen}
                                <div class="detail-content">
                                    <CoinDetail coinId={selectedCoinId} />
                                </div>
                            {/if}
                        </div>

                        {#if tradeSuggestion}
                            <div class="glass-card suggestion-card" class:warning={tradeSuggestion.tradeStatus.includes('⚠️')}>
                                <div class="s-head">
                                    <div style="display: flex; align-items: center;">
                                        <span class="s-badge" style="background: {tradeSuggestion.setup.rr >= 2 ? '#00e676' : '#fbbf24'}">{tradeSuggestion.type}</span>
                                        <InfoTooltip text="TradingMonitor 交易建議引擎&#10;根據 Calibrated Model 結合動態相關性矩陣、盈虧比 (RR) 輸出進出場與止損建議。" />
                                    </div>
                                    <span class="s-status">{tradeSuggestion.tradeStatus}</span>
                                    <span class="s-reason">{tradeSuggestion.reason}</span>
                                </div>
                                <div class="s-body">
                                    <div class="s-item">
                                        <span class="label">建議進場</span>
                                        <span class="val">${tradeSuggestion.setup.entry}</span>
                                    </div>
                                    <div class="s-item">
                                        <span class="label">目標價位</span>
                                        <span class="val" style="color: #00e676">${tradeSuggestion.setup.target}</span>
                                    </div>
                                    <div class="s-item">
                                        <span class="label">失效止損</span>
                                        <span class="val" style="color: #ff5252">${tradeSuggestion.setup.stopLoss}</span>
                                    </div>
                                    <div class="s-item">
                                        <span class="label">盈虧比 (RR)</span>
                                        <span class="val" style="color: {tradeSuggestion.setup.rr >= 2 ? '#00e676' : '#fbbf24'}">{tradeSuggestion.setup.rr}</span>
                                    </div>
                                </div>
                            </div>
                        {/if}
                    </section>

                    <aside class="panel right-panel">
                        <div class="glass-card">
                            <RankingCard title="🔥 熱門幣" icon="🔥" type="hot" onSelectCoin={handleRankingCoinSelect} />
                        </div>
                        <div class="glass-card">
                            <RankingCard title="📈 漲幅榜" icon="📈" type="gainers" onSelectCoin={handleRankingCoinSelect} />
                        </div>
                        <div class="glass-card">
                            <RankingCard title="📉 跌幅榜" icon="📉" type="losers" onSelectCoin={handleRankingCoinSelect} />
                        </div>
                    </aside>
                </div>
            {:else if activeView === 'squeeze'}
                <div class="glass-card">
                    <SqueezeAlert onSelectCoin={handleSqueezeSelect} filterHighConsensus={filterHighConsensus} />
                </div>
            {:else if activeView === 'whale'}
                <div class="glass-card">
                    <div class="view-header">
                        <h2>大戶流動性 <InfoTooltip text="TradingMonitor 大戶流動性追蹤&#10;監控百萬美元級掛單牆，追蹤主力意圖 (WCI)，識別防守與突破行為。" /></h2>
                    </div>
                    <WhaleOrderBook visible={true} />
                </div>
            {:else if activeView === 'anchor'}
                <div class="glass-card">
                    <div class="view-header">
                        <h2>歷史市場錨點 <InfoTooltip text="TradingMonitor 歷史市場錨點&#10;透過量價分佈與歷史多次驗證的頂底轉換區，建立長期關鍵防守與壓力位。" /></h2>
                    </div>
                    <AnchorZones visible={true} symbol={selectedBinanceSymbol} currentPrice={currentPrices[selectedBinanceSymbol] || 0} />
                </div>
            {:else if activeView === 'sector'}
                <div class="glass-card">
                    <div class="view-header">
                        <h2>板塊熱力圖 <InfoTooltip text="TradingMonitor 板塊資金熱力圖&#10;追蹤各板塊資金輪動方向，挖掘高強度的強勢板塊。" /></h2>
                    </div>
                    <SectorHeatmap />
                </div>
            {:else if activeView === 'news'}
                <div class="glass-card">
                    <NewsPanel />
                </div>
            {/if}
        </main>

        <footer class="dash-footer">
            <span>© 2026 TradingMonitor · 資料來源：Binance · CoinGecko · CryptoCompare</span>
        </footer>
    </div>

    <!-- Sidebar Menu -->
    <nav class="sidebar-menu glass-card" class:open={sidebarOpen}>
        <div class="sidebar-header">
            <div class="logo-area">
                <div class="logo-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00e676" stroke-width="2.5">
                        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
                    </svg>
                </div>
                <span class="logo-text">Menu</span>
            </div>
            <button class="close-btn mobile-only" onclick={() => sidebarOpen = false}>✕</button>
        </div>
        
        <div class="menu-list">
            <button class="menu-item" class:active={activeView === 'dashboard'} onclick={() => { activeView = 'dashboard'; sidebarOpen = false; }}>
                <span class="m-icon">📊</span><span class="m-text">綜合看板</span>
            </button>
            <button class="menu-item" class:active={activeView === 'squeeze'} onclick={() => { activeView = 'squeeze'; sidebarOpen = false; }}>
                <span class="m-icon">⚠️</span><span class="m-text">波動預警</span>
            </button>
            <button class="menu-item" class:active={activeView === 'whale'} onclick={() => { activeView = 'whale'; sidebarOpen = false; }}>
                <span class="m-icon">🐋</span><span class="m-text">大戶流動性</span>
            </button>
            <button class="menu-item" class:active={activeView === 'anchor'} onclick={() => { activeView = 'anchor'; sidebarOpen = false; }}>
                <span class="m-icon">⚓</span><span class="m-text">歷史錨點</span>
            </button>
            <button class="menu-item" class:active={activeView === 'sector'} onclick={() => { activeView = 'sector'; sidebarOpen = false; }}>
                <span class="m-icon">🌡️</span><span class="m-text">板塊熱力圖</span>
            </button>
            <button class="menu-item" class:active={activeView === 'news'} onclick={() => { activeView = 'news'; sidebarOpen = false; }}>
                <span class="m-icon">📰</span><span class="m-text">新聞資訊</span>
            </button>
        </div>

        <div class="sidebar-settings">
            <div class="settings-title">系統設定</div>
            <label class="check-item">
                <input type="checkbox" bind:checked={filterHighConsensus} /> 強共振預警 (> 50%)
            </label>
        </div>
    </nav>
</div>

<style>

    .app-layout {
        display: flex;
        min-height: 100vh;
        max-width: 1600px;
        margin: 0 auto;
        padding: 0;
        position: relative;
    }
    .main-content {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        padding: 0 16px 16px 16px;
        order: 1; /* Main content on Left */
    }
    .sidebar-menu {
        width: 260px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 20px 16px;
        background: rgba(12, 14, 26, 0.8);
        border-left: 1px solid rgba(255,255,255,0.06);
        border-right: none;
        order: 2; /* Sidebar on Right for Desktop */
        height: 100vh;
        position: sticky;
        top: 0;
        border-radius: 0;
        overflow-y: auto;
    }
    .sidebar-overlay {
        display: none;
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6);
        z-index: 999;
        opacity: 0;
        transition: opacity 0.3s;
    }
    .sidebar-overlay.open {
        display: block;
        opacity: 1;
    }

    .hamburger-btn {
        display: none;
        background: transparent;
        border: none;
        color: #fff;
        padding: 8px;
        cursor: pointer;
    }
    .close-btn.mobile-only {
        display: none;
        background: transparent;
        border: none;
        color: #fff;
        font-size: 1.2rem;
        cursor: pointer;
    }
    
    .sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .menu-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        flex: 1;
    }
    .menu-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: transparent;
        border: none;
        border-radius: 10px;
        color: rgba(255,255,255,0.6);
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        text-align: left;
    }
    .menu-item:hover {
        background: rgba(255,255,255,0.05);
        color: #fff;
    }
    .menu-item.active {
        background: rgba(0, 230, 118, 0.1);
        color: #00e676;
    }
    .m-icon { font-size: 1.2rem; }
    
    .sidebar-settings {
        padding-top: 16px;
        border-top: 1px solid rgba(255,255,255,0.06);
    }
    .view-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .view-header h2 {
        font-size: 1.1rem;
        font-weight: 700;
        margin: 0 0 16px 0;
        display: flex;
        align-items: center;
        color: rgba(255,255,255,0.9);
    }

    @media (max-width: 1024px) {
        .app-layout {
            flex-direction: column;
        }
        .sidebar-menu {
            position: fixed;
            left: -280px;
            top: 0;
            bottom: 0;
            width: 280px;
            z-index: 1000;
            transition: left 0.3s ease;
            order: unset;
            border-right: 1px solid rgba(255,255,255,0.06);
            border-left: none;
            height: 100%;
        }
        .sidebar-menu.open {
            left: 0;
        }
        .hamburger-btn {
            display: block;
        }
        .close-btn.mobile-only {
            display: block;
        }
        .desktop-logo {
            display: none !important;
        }
    }

    :global(body) {
        margin: 0;
        padding: 0;
        font-family:
            "Inter",
            system-ui,
            -apple-system,
            sans-serif;
        background: #0c0e1a;
        color: #fff;
        overflow-x: hidden;
    }

    :global(*) {
        box-sizing: border-box;
    }

    :global(::-webkit-scrollbar) {
        width: 5px;
    }
    :global(::-webkit-scrollbar-track) {
        background: transparent;
    }
    :global(::-webkit-scrollbar-thumb) {
        background: rgba(255, 255, 255, 0.08);
        border-radius: 5px;
    }

    .dashboard {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        padding: 0 16px 16px 16px;
        gap: 12px;
        max-width: 1600px;
        margin: 0 auto;
        /* Subtle grid background */
        background-image: radial-gradient(
                ellipse at 20% 0%,
                rgba(0, 230, 118, 0.04) 0%,
                transparent 50%
            ),
            radial-gradient(
                ellipse at 80% 100%,
                rgba(99, 102, 241, 0.04) 0%,
                transparent 50%
            );
    }

    .glass-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 14px;
        padding: 16px;
        backdrop-filter: blur(12px);
        transition: border-color 0.3s;
    }
    .glass-card:hover {
        border-color: rgba(255, 255, 255, 0.1);
    }

    /* ---- Header ---- */
    .dash-header {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 8px 0;
    }
    .logo-area {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
    }
    .logo-icon {
        width: 38px;
        height: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 230, 118, 0.1);
        border-radius: 10px;
    }
    .logo-text {
        font-size: 1.15rem;
        font-weight: 700;
        background: linear-gradient(135deg, #00e676, #00b0ff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }
    .search-area {
        flex: 1;
        display: flex;
        justify-content: center;
    }
    .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
    }
    .settings-trigger {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.6);
        padding: 8px;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s;
    }
    .settings-trigger:hover {
        background: rgba(255, 255, 255, 0.12);
        color: #fff;
    }
    .settings-dropdown {
        position: absolute;
        top: 70px;
        right: 16px;
        z-index: 1000;
        width: 220px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #1a1c2e;
        border-color: rgba(99, 102, 241, 0.3);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }
    .settings-title {
        font-size: 0.75rem;
        font-weight: 800;
        color: rgba(255, 255, 255, 0.4);
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    .check-item {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
    }
    .header-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.72rem;
        font-weight: 700;
        color: #00e676;
        letter-spacing: 1px;
        flex-shrink: 0;
        background: rgba(0, 230, 118, 0.08);
        padding: 6px 14px;
        border-radius: 20px;
    }
    .live-dot {
        width: 6px;
        height: 6px;
        background: #00e676;
        border-radius: 50%;
        animation: blink 1.5s ease-in-out infinite;
    }
    @keyframes blink {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.3;
        }
    }

    /* ---- Main Grid ---- */
    .main-grid {
        display: grid;
        grid-template-columns: 280px 1fr 260px;
        gap: 12px;
        flex: 1;
        min-height: 0;
        transition: grid-template-columns 0.3s ease;
    }
    .main-grid.no-news {
        grid-template-columns: 1fr 260px;
    }
    .main-grid.no-rankings {
        grid-template-columns: 280px 1fr;
    }
    .main-grid.only-center {
        grid-template-columns: 1fr;
    }

    .left-panel {
        max-height: calc(100vh - 200px);
        overflow: hidden;
    }
    .center-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 0;
    }
    .chart-card {
        flex: 1;
        min-height: 420px;
    }
    .detail-toggle-card {
        overflow: hidden;
    }
    .toggle-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 10px 4px;
        background: transparent;
        border: none;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.6);
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: color 0.2s;
        font-family: inherit;
    }
    .toggle-btn:hover {
        color: rgba(255, 255, 255, 0.9);
    }
    .toggle-icon {
        display: flex;
        transition: transform 0.3s ease;
    }
    .toggle-icon.open {
        transform: rotate(180deg);
    }
    .detail-content {
        max-height: 420px;
        overflow-y: auto;
        padding-top: 12px;
        animation: slideDown 0.3s ease;
    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-8px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    /* Trade Suggestion Styles */
    .suggestion-card {
        border-left: 4px solid #00e676;
        animation: slideDown 0.4s ease;
    }
    .suggestion-card.warning {
        border-left-color: #ff5252;
        background: rgba(255, 82, 82, 0.05);
    }
    .s-status {
        font-size: 0.8rem;
        font-weight: 700;
        color: #fbbf24;
    }
    .s-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }
    .s-badge {
        background: #fbbf24;
        color: #000;
        font-size: 0.75rem;
        font-weight: 800;
        padding: 4px 10px;
        border-radius: 4px;
    }
    .s-reason {
        font-size: 0.72rem;
        color: rgba(255,255,255,0.5);
        font-weight: 600;
    }
    .s-body {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
    }
    .s-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .s-item .label {
        font-size: 0.7rem;
        color: rgba(255,255,255,0.4);
        font-weight: 700;
        text-transform: uppercase;
    }
    .s-item .val {
        font-size: 0.95rem;
        font-weight: 800;
        color: #fff;
    }
    .right-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: calc(100vh - 200px);
        overflow-y: auto;
    }

    /* ---- Whale Section ---- */
    .whale-section {
        margin-top: 4px;
    }

    /* ---- Sector Section ---- */
    .sector-section {
        margin-top: 4px;
    }

    /* ---- Footer ---- */
    .dash-footer {
        text-align: center;
        font-size: 0.72rem;
        color: rgba(255, 255, 255, 0.2);
        padding: 16px 0 8px;
    }

    /* ---- Responsive ---- */
    @media (max-width: 1200px) {
        .main-grid {
            grid-template-columns: 1fr 1fr !important;
        }
        .left-panel {
            grid-column: 1 / -1;
            max-height: 300px;
        }
        .right-panel {
            max-height: none;
        }
    }
    @media (max-width: 768px) {
        .main-grid {
            grid-template-columns: 1fr !important;
        }
        .dash-header {
            flex-wrap: wrap;
        }
        .search-area {
            order: 3;
            flex-basis: 100%;
        }
        .left-panel {
            max-height: 250px;
        }
        .logo-text {
            font-size: 1rem;
        }
    }

    /* ---- Marquee ---- */
    .news-marquee {
        width: calc(100% + 32px);
        margin-left: -16px;
        background: rgba(0, 230, 118, 0.1);
        border-bottom: 1px solid rgba(0, 230, 118, 0.2);
        overflow: hidden;
        white-space: nowrap;
        padding: 6px 0;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
    }
    .marquee-content {
        display: inline-block;
        padding-left: 100%;
        animation: marquee 30s linear infinite;
    }
    .marquee-content:hover {
        animation-play-state: paused;
    }
    .marquee-item {
        display: inline-block;
        margin-right: 50px;
        font-size: 0.85rem;
    }
    .marquee-item a {
        color: #e2e8f0;
        text-decoration: none;
        font-weight: 500;
        transition: color 0.2s;
    }
    .marquee-item a:hover {
        color: #00e676;
    }
    .m-source {
        color: #00e676;
        font-weight: 700;
        margin-right: 6px;
    }
    @keyframes marquee {
        0% { transform: translateX(0); }
        100% { transform: translateX(-100%); }
    }
</style>
