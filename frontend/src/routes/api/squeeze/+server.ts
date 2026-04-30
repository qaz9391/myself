import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cachedFetch, binanceLimiter, rateLimitedFetch } from '$lib/server/apiCache';
import { env } from '$env/dynamic/private';

const BINANCE_BASE = 'https://api.binance.com';

// Stablecoins / leveraged tokens to exclude
const EXCLUDED = new Set([
    'USDCUSDT', 'BUSDUSDT', 'TUSDUSDT', 'DAIUSDT', 'FDUSDUSDT', 'EURUSDT',
]);

// Dynamically fetch top 50 USDT pairs by 24h volume
async function getTopSymbols(): Promise<string[]> {
    return cachedFetch('squeeze:top_symbols', 600_000, async () => {
        const res = await rateLimitedFetch(`${BINANCE_BASE}/api/v3/ticker/24hr`, binanceLimiter);
        if (!res.ok) throw new Error('Failed to fetch ticker');
        const tickers = await res.json();

        return tickers
            .filter((t: any) => {
                const s = t.symbol as string;
                if (!s.endsWith('USDT')) return false;
                if (EXCLUDED.has(s)) return false;
                const base = s.replace('USDT', '');
                if (base.endsWith('UP') || base.endsWith('DOWN')) return false;
                if (base.length < 2) return false;
                return true;
            })
            .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
            .slice(0, 100)
            .map((t: any) => t.symbol);
    });
}

function linearRegression(y: number[]) {
    const n = y.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += y[i];
        sumXY += i * y[i];
        sumXX += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return { slope };
}

function identifyPattern(highs: number[], lows: number[]) {
    if (highs.length < 5) return { type: "none", direction: "neutral", char: "" };
    
    // Normalize to handle different crypto price scales
    const h0 = highs[0] || 1;
    const l0 = lows[0] || 1;
    const normHighs = highs.map(h => h / h0);
    const normLows = lows.map(l => l / l0);
    
    const hs = linearRegression(normHighs).slope;
    const ls = linearRegression(normLows).slope;

    if (Math.abs(hs) < 0.0005 && ls > 0.001) return { type: "ascending_triangle", direction: "up", char: "▲" };
    if (Math.abs(ls) < 0.0005 && hs < -0.001) return { type: "descending_triangle", direction: "down", char: "▼" };
    if (hs < -0.001 && ls > 0.001) return { type: "symmetrical_triangle", direction: "neutral", char: "◆" };
    if (Math.abs(hs) <= 0.0005 && Math.abs(ls) <= 0.0005) return { type: "rectangle", direction: "neutral", char: "■" };
    
    return { type: "none", direction: "neutral", char: "" };
}

function isVolumeContracted(volumes: number[], windowSize = 5) {
    if (volumes.length < windowSize * 3) return { contracted: false, ratioStr: "", ratio: 100 };
    const recent = volumes.slice(-windowSize);
    const baseline = volumes.slice(-windowSize * 3, -windowSize);
    const recentAvg = recent.reduce((a,b)=>a+b,0) / windowSize;
    const baselineAvg = baseline.reduce((a,b)=>a+b,0) / (windowSize*2) || 1;
    
    const contracted = recentAvg < baselineAvg * 0.7;
    const ratio = (recentAvg / baselineAvg) * 100;
    return {
        contracted,
        ratio,
        ratioStr: ratio.toFixed(1) + "%"
    };
}

function calculateSqueeze(data: number[][]) {
    const sqzLen = 20;
    const sqzMinBars = 5;
    const bbMult = 2.0;
    const kcMult = 1.29;

    if (data.length < sqzLen + 1) return { isSqueeze: false, count: 0, price: 0, pattern: { type: "none", direction: "neutral", char: "" }, volumeAlert: { contracted: false, ratioStr: "", ratio: 100 }, emaTrend: "neutral" };

    const closes = data.map(d => d[4]); // close
    const highs = data.map(d => d[2]);
    const lows = data.map(d => d[3]);
    const volumes = data.map(d => d[5]);

    // Simple Moving Average
    const sma = (arr: number[], len: number, idx: number) => {
        let sum = 0;
        for (let i = idx - len + 1; i <= idx; i++) sum += arr[i];
        return sum / len;
    };

    // Standard Deviation
    const stdev = (arr: number[], len: number, idx: number) => {
        const mean = sma(arr, len, idx);
        let sumSq = 0;
        for (let i = idx - len + 1; i <= idx; i++) sumSq += (arr[i] - mean) ** 2;
        return Math.sqrt(sumSq / len);
    };

    // True Range
    const trueRange = (i: number) => {
        if (i === 0) return highs[i] - lows[i];
        return Math.max(
            highs[i] - lows[i],
            Math.abs(highs[i] - closes[i - 1]),
            Math.abs(lows[i] - closes[i - 1])
        );
    };

    let sqzCount = 0;
    let lastIdx = closes.length - 1;

    // Calculate from the end backwards
    for (let i = lastIdx; i >= sqzLen; i--) {
        const s = sma(closes, sqzLen, i);
        const sd = stdev(closes, sqzLen, i);
        const upperBB = s + bbMult * sd;
        const lowerBB = s - bbMult * sd;

        // KC range using ATR-like calculation
        let trSum = 0;
        for (let j = i - sqzLen + 1; j <= i; j++) trSum += trueRange(j);
        const rangeMa = trSum / sqzLen;
        const upperKC = s + kcMult * rangeMa;
        const lowerKC = s - kcMult * rangeMa;

        const isSqz = lowerBB > lowerKC && upperBB < upperKC;

        if (i === lastIdx) {
            sqzCount = isSqz ? 1 : 0;
        } else if (isSqz) {
            sqzCount++;
        } else {
            break;
        }
    }

    // --- EMA Calculations ---
    const calcEMA = (period: number) => {
        if (closes.length < period) return closes[closes.length - 1];
        let k = 2 / (period + 1);
        let ema = closes.slice(0, period).reduce((a,b)=>a+b,0) / period; // SMA for first val
        for (let i = period; i <= lastIdx; i++) {
            ema = (closes[i] - ema) * k + ema;
        }
        return ema;
    };
    
    let emaTrend = "neutral";
    if (sqzCount >= sqzMinBars || closes.length >= 200) {
        const ema21 = calcEMA(21);
        const ema55 = calcEMA(55);
        const ema200 = calcEMA(200);
        if (ema21 > ema55 && ema55 > ema200) emaTrend = "bullish";
        else if (ema21 < ema55 && ema55 < ema200) emaTrend = "bearish";
    }

    let pattern = { type: "none", direction: "neutral", char: "" };
    let volumeAlert = { contracted: false, ratioStr: "", ratio: 100 };

    if (sqzCount >= sqzMinBars) {
        // Look at the bars during the squeeze
        const lookback = Math.min(sqzCount, 30);
        const sqzHighs = highs.slice(lastIdx - lookback + 1, lastIdx + 1);
        const sqzLows = lows.slice(lastIdx - lookback + 1, lastIdx + 1);
        const sqzVols = volumes.slice(lastIdx - lookback * 2, lastIdx + 1);
        
        pattern = identifyPattern(sqzHighs, sqzLows);
        volumeAlert = isVolumeContracted(sqzVols, Math.max(5, Math.floor(lookback/2)));
    }

    return {
        isSqueeze: sqzCount >= sqzMinBars,
        count: sqzCount,
        price: closes[lastIdx],
        pattern,
        volumeAlert,
        emaTrend
    };
}

export const GET: RequestHandler = async ({ url }) => {
    const timeframe = url.searchParams.get('timeframe') || '4h';

    // Validate timeframe
    const validTimeframes = ['1h', '4h', '1d'];
    const tf = validTimeframes.includes(timeframe) ? timeframe : '4h';

    try {
        const data = await cachedFetch(
            `squeeze:${tf}`,
            300_000, // 5 min TTL
            async () => {
                const results: any[] = [];
                const symbols = await getTopSymbols();

                // Optimized: Process all symbols in parallel to avoid Vercel timeout
                const tasks = symbols.map(async (symbol) => {
                    try {
                        const apiUrl = `${BINANCE_BASE}/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=300`;
                        const res = await rateLimitedFetch(apiUrl, binanceLimiter, {
                            headers: env.BINANCE_API_KEY ? { 'X-MBX-APIKEY': env.BINANCE_API_KEY } : {}
                        });

                        if (res.ok) {
                            const klines = await res.json();
                            const parsed = klines.map((k: any[]) => k.map(Number));
                            const squeeze = calculateSqueeze(parsed);

                            if (squeeze.isSqueeze) {
                                return {
                                    symbol: symbol.replace('USDT', '/USDT'),
                                    binanceSymbol: symbol,
                                    count: squeeze.count,
                                    price: squeeze.price,
                                    timeframe: tf,
                                    pattern: squeeze.pattern,
                                    volumeAlert: squeeze.volumeAlert,
                                    emaTrend: squeeze.emaTrend
                                };
                            }
                        }
                    } catch (e) {
                        console.error(`[squeeze] Error scanning ${symbol}:`, e);
                    }
                    return null;
                });

                const allResults = await Promise.all(tasks);
                const filtered = allResults.filter(r => r !== null);

                return filtered.sort((a, b) => b.count - a.count);
            }
        );

        return json(data);
    } catch (err: any) {
        console.error('[/api/squeeze] Error:', err.message);
        return json([]);
    }
};
