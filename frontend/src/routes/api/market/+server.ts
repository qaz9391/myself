import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cachedFetch, coingeckoLimiter, binanceLimiter, rateLimitedFetch } from '$lib/server/apiCache';
import { env } from '$env/dynamic/private';

const BINANCE_FAPI = 'https://fapi.binance.com/fapi/v1';

// Stablecoins / leveraged tokens to exclude from gainers/losers
const EXCLUDED_SUFFIXES = ['UP', 'DOWN', 'BULL', 'BEAR'];
const EXCLUDED_PAIRS = new Set([
    'USDCUSDT', 'BUSDUSDT', 'TUSDUSDT', 'DAIUSDT', 'FDUSDUSDT',
    'EURUSDT', 'GBPUSDT', 'AUDUSDT', 'BRLUSDT', 'TRYUSDT',
    'AEURUSDT', 'USDPUSDT', 'USTCUSDT',
]);

function isValidPair(symbol: string): boolean {
    if (!symbol.endsWith('USDT')) return false;
    if (EXCLUDED_PAIRS.has(symbol)) return false;
    const base = symbol.replace('USDT', '');
    if (EXCLUDED_SUFFIXES.some(s => base.endsWith(s))) return false;
    if (base.length < 2) return false;
    return true;
}

export const GET: RequestHandler = async ({ url }) => {
    const type = url.searchParams.get('type') || 'hot';

    try {
        // Use Binance Futures 24hr ticker for all rankings — matches Binance phone app
        const data = await cachedFetch(
            `market:binance_fapi_ticker`,
            60_000, // 1 min TTL
            async () => {
                const apiUrl = `${BINANCE_FAPI}/ticker/24hr`;
                const res = await rateLimitedFetch(apiUrl, binanceLimiter, {
                    headers: env.BINANCE_API_KEY ? { 'X-MBX-APIKEY': env.BINANCE_API_KEY } : {}
                });
                if (!res.ok) throw new Error(`Binance fapi error: ${res.status}`);
                return await res.json();
            }
        );

        // Filter to USDT pairs
        let filtered = data.filter((t: any) => {
            if (!isValidPair(t.symbol)) return false;
            return true;
        });

        // Sort based on type
        if (type === 'gainers') {
            filtered.sort((a: any, b: any) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent));
        } else if (type === 'losers') {
            filtered.sort((a: any, b: any) => parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent));
        } else {
            // 'hot' -> Sort by quoteVolume (USDT volume)
            filtered.sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
        }

        // Map to unified format
        const result = filtered.slice(0, 20).map((t: any) => {
            const base = t.symbol.replace('USDT', '');
            return {
                id: base.toLowerCase(),
                symbol: base.toLowerCase(),
                name: t.symbol.replace('USDT', '/USDT'),
                image: `https://cdn.jsdelivr.net/gh/nicholasgasior/cryptocurrency-icons@master/svg/color/${base.toLowerCase()}.svg`,
                current_price: parseFloat(t.lastPrice),
                price_change_percentage_24h: parseFloat(t.priceChangePercent),
                total_volume: parseFloat(t.quoteVolume),
                market_cap: null,
                binanceSymbol: t.symbol,
            };
        });

        return json(result);

    } catch (err: any) {
        console.error('[/api/market] Error:', err.message);
        return json({ error: err.message }, { status: 500 });
    }
};
