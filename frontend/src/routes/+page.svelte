<script lang="ts">
    import SearchBar from '$lib/components/SearchBar.svelte';
    import NewsPanel from '$lib/components/NewsPanel.svelte';
    import KlineChart from '$lib/components/KlineChart.svelte';
    import CoinDetail from '$lib/components/CoinDetail.svelte';
    import RankingCard from '$lib/components/RankingCard.svelte';
    import SqueezeAlert from '$lib/components/SqueezeAlert.svelte';
    import SectorHeatmap from '$lib/components/SectorHeatmap.svelte';

    // Map of CoinGecko coin ID -> Binance symbol
    const coinToBinance: Record<string, string> = {
        bitcoin: 'BTCUSDT', ethereum: 'ETHUSDT', solana: 'SOLUSDT',
        binancecoin: 'BNBUSDT', ripple: 'XRPUSDT', dogecoin: 'DOGEUSDT',
        cardano: 'ADAUSDT', 'avalanche-2': 'AVAXUSDT', polkadot: 'DOTUSDT',
        'matic-network': 'MATICUSDT', chainlink: 'LINKUSDT', litecoin: 'LTCUSDT',
        cosmos: 'ATOMUSDT', uniswap: 'UNIUSDT', near: 'NEARUSDT',
        aptos: 'APTUSDT', optimism: 'OPUSDT', arbitrum: 'ARBUSDT',
        sui: 'SUIUSDT', sei: 'SEIUSDT', 'shiba-inu': 'SHIBUSDT',
        pepe: 'PEPEUSDT', tron: 'TRXUSDT',
    };

    let selectedCoinId = $state('bitcoin');
    let selectedCoinName = $state('Bitcoin');
    let selectedBinanceSymbol = $state('BTCUSDT');
    let detailOpen = $state(false);

    function handleCoinSelect(coin: any) {
        // From search dropdown (CoinGecko search result)
        selectedCoinId = coin.id;
        selectedCoinName = coin.name;
        selectedBinanceSymbol = coinToBinance[coin.id] || `${coin.symbol?.toUpperCase()}USDT`;
    }

    function handleRankingCoinSelect(coin: any) {
        // From ranking cards — may be CoinGecko (hot) or Binance (gainers/losers)
        if (coin.binanceSymbol) {
            // Binance-sourced data
            selectedBinanceSymbol = coin.binanceSymbol;
            selectedCoinName = coin.binanceSymbol.replace('USDT', '');
            const key = coin.binanceSymbol.replace('USDT', '').toLowerCase();
            selectedCoinId = binanceToCoinId[key] || key;
        } else {
            // CoinGecko-sourced data
            selectedCoinId = coin.id;
            selectedCoinName = coin.name;
            selectedBinanceSymbol = coinToBinance[coin.id] || `${coin.symbol?.toUpperCase()}USDT`;
        }
    }

    // Reverse map: Binance symbol (without USDT) -> CoinGecko ID
    const binanceToCoinId: Record<string, string> = Object.fromEntries(
        Object.entries(coinToBinance).map(([cgId, bSymbol]) => [bSymbol.replace('USDT', '').toLowerCase(), cgId])
    );

    function handleSqueezeSelect(coin: { binanceSymbol: string; name: string; id: string }) {
        const sym = coin.binanceSymbol || '';
        selectedBinanceSymbol = sym;
        selectedCoinName = coin.name || sym.replace('USDT', '/USDT');
        // Try to resolve CoinGecko ID
        const key = sym.replace('USDT', '').toLowerCase();
        selectedCoinId = binanceToCoinId[key] || key;
    }
</script>

<svelte:head>
    <title>TradingMonitor — 加密貨幣即時儀表板</title>
    <meta name="description" content="即時監控加密貨幣市場：K線圖表、漲跌幅排行、板塊分析、波動預警一站掌握" />
</svelte:head>

<div class="dashboard">
    <!-- Header -->
    <header class="dash-header">
        <div class="logo-area">
            <div class="logo-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00e676" stroke-width="2.5">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
                </svg>
            </div>
            <span class="logo-text">TradingMonitor</span>
        </div>
        <div class="search-area">
            <SearchBar onSelect={handleCoinSelect} />
        </div>
        <div class="header-badge">
            <span class="live-dot"></span>
            <span>LIVE</span>
        </div>
    </header>

    <!-- Main Grid -->
    <main class="main-grid">
        <!-- Left Column: News -->
        <aside class="panel left-panel glass-card">
            <NewsPanel />
        </aside>

        <!-- Center Column: Chart + Coin Detail -->
        <section class="center-panel">
            <div class="glass-card chart-card">
                <KlineChart symbol={selectedBinanceSymbol} coinName={selectedCoinName} />
            </div>

            <!-- Collapsible detail / squeeze swap area -->
            <div class="glass-card detail-toggle-card">
                <button class="toggle-btn" onclick={() => detailOpen = !detailOpen} id="toggle-detail">
                    <span class="toggle-icon" class:open={detailOpen}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </span>
                    <span>{detailOpen ? '收起幣種詳情' : '展開幣種詳情'}</span>
                </button>

                {#if detailOpen}
                    <div class="detail-content">
                        <CoinDetail coinId={selectedCoinId} />
                    </div>
                {:else}
                    <div class="squeeze-in-center">
                        <SqueezeAlert onSelectCoin={handleSqueezeSelect} />
                    </div>
                {/if}
            </div>
        </section>

        <!-- Right Column: Rankings + Alerts -->
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
            {#if detailOpen}
                <div class="glass-card">
                    <SqueezeAlert onSelectCoin={handleSqueezeSelect} />
                </div>
            {/if}
        </aside>
    </main>

    <!-- Sector Heatmap -->
    <section class="sector-section glass-card">
        <SectorHeatmap />
    </section>

    <!-- Footer -->
    <footer class="dash-footer">
        <span>© 2026 TradingMonitor · 資料來源：Binance · CoinGecko · CryptoCompare</span>
    </footer>
</div>

<style>
    :global(body) {
        margin: 0;
        padding: 0;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
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
        background: rgba(255,255,255,0.08);
        border-radius: 5px;
    }

    .dashboard {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        padding: 12px 16px;
        gap: 12px;
        max-width: 1600px;
        margin: 0 auto;
        /* Subtle grid background */
        background-image:
            radial-gradient(ellipse at 20% 0%, rgba(0, 230, 118, 0.04) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 100%, rgba(99, 102, 241, 0.04) 0%, transparent 50%);
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
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
    }

    /* ---- Main Grid ---- */
    .main-grid {
        display: grid;
        grid-template-columns: 280px 1fr 260px;
        gap: 12px;
        flex: 1;
        min-height: 0;
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
        border-bottom: 1px solid rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.6);
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: color 0.2s;
        font-family: inherit;
    }
    .toggle-btn:hover {
        color: rgba(255,255,255,0.9);
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
    .squeeze-in-center {
        padding-top: 12px;
        animation: slideDown 0.3s ease;
    }
    @keyframes slideDown {
        from { opacity: 0; transform: translateY(-8px); }
        to   { opacity: 1; transform: translateY(0); }
    }
    .right-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: calc(100vh - 200px);
        overflow-y: auto;
    }

    /* ---- Sector Section ---- */
    .sector-section {
        margin-top: 4px;
    }

    /* ---- Footer ---- */
    .dash-footer {
        text-align: center;
        font-size: 0.72rem;
        color: rgba(255,255,255,0.2);
        padding: 16px 0 8px;
    }

    /* ---- Responsive ---- */
    @media (max-width: 1200px) {
        .main-grid {
            grid-template-columns: 1fr 1fr;
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
            grid-template-columns: 1fr;
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
</style>
