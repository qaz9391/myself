<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { createChart, type IChartApi, ColorType, type CandlestickData, type Time, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';

    let { symbol = 'BTCUSDT', coinName = 'Bitcoin' }: { symbol?: string; coinName?: string } = $props();

    let chartContainer: HTMLDivElement;
    let chart: IChartApi | null = null;
    let candleSeries: any = null;
    let volumeSeries: any = null;
    let ema21Series: any = null;
    let ema55Series: any = null;
    let ema100Series: any = null;
    let ema200Series: any = null;
    let squeezeSeries: any = null;
    let activeInterval = $state('4h');
    let loading = $state(true);
    let error = $state('');
    let showEma = $state(true);
    let showSqueeze = $state(true);

    const intervals = [
        { label: '1H', value: '1h' },
        { label: '4H', value: '4h' },
        { label: '1D', value: '1d' },
        { label: '1W', value: '1w' },
    ];

    // ---- EMA Calculation ----
    function calculateEMA(closes: number[], period: number): (number | null)[] {
        const ema: (number | null)[] = [];
        const k = 2 / (period + 1);

        for (let i = 0; i < closes.length; i++) {
            if (i < period - 1) {
                ema.push(null);
            } else if (i === period - 1) {
                // First EMA = SMA of first 'period' values
                let sum = 0;
                for (let j = 0; j < period; j++) sum += closes[j];
                ema.push(sum / period);
            } else {
                const prev = ema[i - 1];
                if (prev !== null) {
                    ema.push(closes[i] * k + prev * (1 - k));
                } else {
                    ema.push(null);
                }
            }
        }
        return ema;
    }

    // ---- Squeeze Calculation (BB inside KC) ----
    function calculateSqueeze(data: any[]): boolean[] {
        const sqzLen = 20;
        const bbMult = 2.0;
        const kcMult = 1.29;
        const result: boolean[] = [];

        for (let i = 0; i < data.length; i++) {
            if (i < sqzLen) {
                result.push(false);
                continue;
            }

            // SMA
            let smaSum = 0;
            for (let j = i - sqzLen + 1; j <= i; j++) smaSum += data[j].close;
            const sma = smaSum / sqzLen;

            // StdDev
            let sqSum = 0;
            for (let j = i - sqzLen + 1; j <= i; j++) sqSum += (data[j].close - sma) ** 2;
            const stdev = Math.sqrt(sqSum / sqzLen);

            // BB
            const upperBB = sma + bbMult * stdev;
            const lowerBB = sma - bbMult * stdev;

            // True Range & KC
            let trSum = 0;
            for (let j = i - sqzLen + 1; j <= i; j++) {
                const hi = data[j].high;
                const lo = data[j].low;
                const prevClose = j > 0 ? data[j - 1].close : data[j].close;
                trSum += Math.max(hi - lo, Math.abs(hi - prevClose), Math.abs(lo - prevClose));
            }
            const rangeMa = trSum / sqzLen;
            const upperKC = sma + kcMult * rangeMa;
            const lowerKC = sma - kcMult * rangeMa;

            result.push(lowerBB > lowerKC && upperBB < upperKC);
        }
        return result;
    }

    function initChart() {
        if (!chartContainer || chart) return;

        chart = createChart(chartContainer, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: 'rgba(255,255,255,0.6)',
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 11,
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.04)' },
                horzLines: { color: 'rgba(255,255,255,0.04)' },
            },
            crosshair: {
                vertLine: { color: 'rgba(0, 230, 118, 0.3)', width: 1, style: 2 },
                horzLine: { color: 'rgba(0, 230, 118, 0.3)', width: 1, style: 2 },
            },
            rightPriceScale: {
                borderColor: 'rgba(255,255,255,0.08)',
                scaleMargins: { top: 0.05, bottom: 0.2 },
            },
            timeScale: {
                borderColor: 'rgba(255,255,255,0.08)',
                timeVisible: true,
                secondsVisible: false,
            },
            handleScroll: { vertTouchDrag: false },
        });

        // Candlestick
        candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#00e676',
            downColor: '#ff5252',
            borderUpColor: '#00e676',
            borderDownColor: '#ff5252',
            wickUpColor: '#00e676',
            wickDownColor: '#ff5252',
        });

        // Volume
        volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });
        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
        });

        // EMA Lines
        ema21Series = chart.addSeries(LineSeries, {
            color: '#ffeb3b',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
        });

        ema55Series = chart.addSeries(LineSeries, {
            color: '#ff9800',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
        });

        ema100Series = chart.addSeries(LineSeries, {
            color: '#2196f3',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
        });

        ema200Series = chart.addSeries(LineSeries, {
            color: '#e040fb',
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
        });

        // Squeeze indicator — rendered as colored dots at the bottom of chart
        squeezeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'price' },
            priceScaleId: 'squeeze',
        });
        squeezeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.95, bottom: 0 },
            visible: false,
        });

        handleResize();
    }

    async function loadData() {
        loading = true;
        error = '';
        try {
            const res = await fetch(`/api/kline?symbol=${symbol}&interval=${activeInterval}&limit=300`);
            if (!res.ok) throw new Error('Failed to load kline data');
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            if (candleSeries && data.length > 0) {
                const candles: CandlestickData<Time>[] = data.map((d: any) => ({
                    time: d.time as Time,
                    open: d.open,
                    high: d.high,
                    low: d.low,
                    close: d.close,
                }));

                const volumes = data.map((d: any) => ({
                    time: d.time as Time,
                    value: d.volume,
                    color: d.close >= d.open ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 82, 82, 0.15)',
                }));

                candleSeries.setData(candles);
                volumeSeries?.setData(volumes);

                // ---- Calculate & render EMAs ----
                const closes = data.map((d: any) => d.close);
                const times = data.map((d: any) => d.time as Time);

                if (showEma) {
                    const ema21 = calculateEMA(closes, 21);
                    const ema55 = calculateEMA(closes, 55);
                    const ema100 = calculateEMA(closes, 100);
                    const ema200 = calculateEMA(closes, 200);

                    const toLineData = (emaArr: (number | null)[]) =>
                        emaArr.map((v, i) => v !== null ? { time: times[i], value: v } : null)
                              .filter(Boolean);

                    ema21Series?.setData(toLineData(ema21));
                    ema55Series?.setData(toLineData(ema55));
                    ema100Series?.setData(toLineData(ema100));
                    ema200Series?.setData(toLineData(ema200));
                } else {
                    ema21Series?.setData([]);
                    ema55Series?.setData([]);
                    ema100Series?.setData([]);
                    ema200Series?.setData([]);
                }

                // ---- Calculate & render Squeeze indicator ----
                if (showSqueeze) {
                    const squeezeFlags = calculateSqueeze(data);
                    const squeezeData = squeezeFlags.map((isSqz, i) => ({
                        time: times[i],
                        value: 1,
                        color: isSqz ? '#ff9800' : 'rgba(0, 230, 118, 0.4)',
                    }));
                    squeezeSeries?.setData(squeezeData);
                } else {
                    squeezeSeries?.setData([]);
                }

                chart?.timeScale().fitContent();
            }
        } catch (e: any) {
            error = e.message;
            console.error('Kline error:', e);
        }
        loading = false;
    }

    function switchInterval(interval: string) {
        activeInterval = interval;
        loadData();
    }

    function toggleEma() {
        showEma = !showEma;
        loadData();
    }

    function toggleSqueeze() {
        showSqueeze = !showSqueeze;
        loadData();
    }

    function handleResize() {
        if (chart && chartContainer) {
            chart.applyOptions({
                width: chartContainer.clientWidth,
                height: chartContainer.clientHeight,
            });
        }
    }

    let resizeObserver: ResizeObserver;
    let prevSymbol = '';

    onMount(() => {
        initChart();
        resizeObserver = new ResizeObserver(() => handleResize());
        resizeObserver.observe(chartContainer);
        loadData();
        prevSymbol = symbol;
    });

    onDestroy(() => {
        resizeObserver?.disconnect();
        chart?.remove();
        chart = null;
    });

    // Re-load data when symbol changes
    $effect(() => {
        const s = symbol;
        if (s && chart && prevSymbol && s !== prevSymbol) {
            prevSymbol = s;
            chart.remove();
            chart = null;
            candleSeries = null;
            volumeSeries = null;
            ema21Series = null;
            ema55Series = null;
            ema100Series = null;
            ema200Series = null;
            squeezeSeries = null;
            initChart();
            loadData();
        }
    });
</script>

<div class="kline-wrapper" id="kline-chart">
    <div class="kline-header">
        <div class="kline-title">
            <h3>{coinName}</h3>
            <span class="kline-symbol">{symbol}</span>
        </div>
        <div class="header-controls">
            <!-- Indicator toggles -->
            <div class="indicator-toggles">
                <button class="ind-btn" class:active={showEma} onclick={toggleEma} title="EMA 21/55/100/200">
                    <span class="ind-dot" style="background: #ffeb3b"></span>
                    EMA
                </button>
                <button class="ind-btn" class:active={showSqueeze} onclick={toggleSqueeze} title="波動預警 (BB-KC Squeeze)">
                    <span class="ind-dot" style="background: #ff9800"></span>
                    SQZ
                </button>
            </div>
            <!-- Interval tabs -->
            <div class="interval-tabs">
                {#each intervals as { label, value }}
                    <button
                        class="interval-btn"
                        class:active={activeInterval === value}
                        onclick={() => switchInterval(value)}
                    >
                        {label}
                    </button>
                {/each}
            </div>
        </div>
    </div>

    <!-- EMA Legend -->
    {#if showEma}
        <div class="ema-legend">
            <span class="ema-tag" style="color: #ffeb3b">EMA21</span>
            <span class="ema-tag" style="color: #ff9800">EMA55</span>
            <span class="ema-tag" style="color: #2196f3">EMA100</span>
            <span class="ema-tag" style="color: #e040fb">EMA200</span>
            {#if showSqueeze}
                <span class="ema-tag squeeze-tag">
                    <span class="sq-dot on"></span> 擠壓中
                    <span class="sq-dot off"></span> 正常
                </span>
            {/if}
        </div>
    {:else if showSqueeze}
        <div class="ema-legend">
            <span class="ema-tag squeeze-tag">
                <span class="sq-dot on"></span> 擠壓中
                <span class="sq-dot off"></span> 正常
            </span>
        </div>
    {/if}

    <div class="chart-area" bind:this={chartContainer}>
        {#if loading}
            <div class="chart-loading">
                <div class="chart-spinner"></div>
                <span>載入圖表中...</span>
            </div>
        {/if}
        {#if error}
            <div class="chart-error">
                <span>⚠️ {error}</span>
            </div>
        {/if}
    </div>
</div>

<style>
    .kline-wrapper {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 300px;
    }
    .kline-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        margin-bottom: 4px;
        flex-wrap: wrap;
        gap: 8px;
    }
    .kline-title {
        display: flex;
        align-items: baseline;
        gap: 10px;
    }
    .kline-title h3 {
        font-size: 1.1rem;
        font-weight: 600;
        margin: 0;
        color: #fff;
    }
    .kline-symbol {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.4);
        font-weight: 500;
    }
    .header-controls {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .indicator-toggles {
        display: flex;
        gap: 4px;
    }
    .ind-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 5px 10px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 6px;
        color: rgba(255,255,255,0.4);
        font-size: 0.72rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
        font-family: inherit;
    }
    .ind-btn:hover {
        border-color: rgba(255,255,255,0.2);
        color: rgba(255,255,255,0.7);
    }
    .ind-btn.active {
        border-color: rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.9);
    }
    .ind-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
    }
    .interval-tabs {
        display: flex;
        gap: 4px;
        background: rgba(255,255,255,0.04);
        padding: 3px;
        border-radius: 8px;
    }
    .interval-btn {
        padding: 5px 12px;
        background: transparent;
        border: none;
        border-radius: 6px;
        color: rgba(255,255,255,0.5);
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }
    .interval-btn:hover {
        color: rgba(255,255,255,0.8);
    }
    .interval-btn.active {
        background: rgba(0, 230, 118, 0.15);
        color: #00e676;
    }
    .ema-legend {
        display: flex;
        gap: 10px;
        padding: 4px 0 2px;
        flex-wrap: wrap;
    }
    .ema-tag {
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.3px;
        opacity: 0.8;
    }
    .squeeze-tag {
        display: flex;
        align-items: center;
        gap: 4px;
        color: rgba(255,255,255,0.5);
    }
    .sq-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        display: inline-block;
    }
    .sq-dot.on { background: #ff9800; }
    .sq-dot.off { background: rgba(0, 230, 118, 0.5); }
    .chart-area {
        flex: 1;
        position: relative;
        min-height: 280px;
    }
    .chart-loading, .chart-error {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        z-index: 5;
        color: rgba(255,255,255,0.5);
        font-size: 0.85rem;
    }
    .chart-spinner {
        width: 28px;
        height: 28px;
        border: 3px solid rgba(255,255,255,0.1);
        border-top-color: #00e676;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
</style>
