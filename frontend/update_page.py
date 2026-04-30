import os

filepath = r'd:\TradingMonitor\frontend\src\routes\+page.svelte'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = content.replace(
    'import AnchorZones from "$lib/components/AnchorZones.svelte";',
    'import AnchorZones from "$lib/components/AnchorZones.svelte";\n    import InfoTooltip from "$lib/components/InfoTooltip.svelte";'
)

# 2. State
state_str = '''
    let showHeatmap = $state(true);
    let settingsOpen = $state(false);

    // v3.0 logic
'''
new_state = '''
    let showHeatmap = $state(true);
    let settingsOpen = $state(false);

    let activeView = $state('dashboard');
    let sidebarOpen = $state(false);

    // v3.0 logic
'''
content = content.replace(state_str, new_state)

# 3. HTML Replacement
html_start = content.find('<div class="dashboard">')
html_end = content.find('<style>')

new_html = '''<div class="app-layout">
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
                    <SqueezeAlert onSelectCoin={handleSqueezeSelect} filterHighConsensus={filterHighConsensus}>
                        {#snippet tooltip()}
                            <InfoTooltip text="TradingMonitor 波動擠壓預警引擎&#10;計算 1H/4H/1D 波動率收斂，結合主力行為判斷潛在爆發方向，共振度 > 50% 觸發高共識預警。" />
                        {/snippet}
                    </SqueezeAlert>
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
</div>\n\n'''

content = content[:html_start] + new_html + content[html_end:]

css_to_add = '''
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
'''

content = content.replace('<style>', '<style>\n' + css_to_add)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
