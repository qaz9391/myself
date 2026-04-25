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
            .slice(0, 50)
            .map((t: any) => t.symbol);
    });
}

function calculateSqueeze(data: number[][]) {
    const sqzLen = 20;
    const sqzMinBars = 5;
    const bbMult = 2.0;
    const kcMult = 1.29;

    if (data.length < sqzLen + 1) return { isSqueeze: false, count: 0 };

    const closes = data.map(d => d[4]); // close
    const highs = data.map(d => d[2]);
    const lows = data.map(d => d[3]);

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

    return {
        isSqueeze: sqzCount >= sqzMinBars,
        count: sqzCount,
        price: closes[lastIdx],
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
                        const apiUrl = `${BINANCE_BASE}/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=100`;
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
