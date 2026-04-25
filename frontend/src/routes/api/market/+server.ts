import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cachedFetch, coingeckoLimiter, binanceLimiter, rateLimitedFetch } from '$lib/server/apiCache';
import { env } from '$env/dynamic/private';

const CG_BASE = 'https://api.coingecko.com/api/v3';
const BINANCE_BASE = 'https://api.binance.com/api/v3';

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
        if (type === 'gainers' || type === 'losers') {
            // Use Binance 24hr ticker for ALL USDT pairs — matches phone app
            const data = await cachedFetch(
                `market:binance_ticker`,
                120_000, // 2 min TTL
                async () => {
                    const apiUrl = `${BINANCE_BASE}/ticker/24hr`;
                    const res = await rateLimitedFetch(apiUrl, binanceLimiter, {
                        headers: env.BINANCE_API_KEY ? { 'X-MBX-APIKEY': env.BINANCE_API_KEY } : {}
                    });
                    if (!res.ok) throw new Error(`Binance ticker error: ${res.status}`);
                    return await res.json();
                }
            );

            // Filter to USDT pairs, exclude stables/leveraged
            let filtered = data.filter((t: any) => isValidPair(t.symbol));

            // Sort
            if (type === 'gainers') {
                filtered.sort((a: any, b: any) =>
                    parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent)
                );
            } else {
                filtered.sort((a: any, b: any) =>
                    parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent)
                );
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

        } else {
            // 'hot' — use CoinGecko for volume-sorted coins (with images)
            const data = await cachedFetch(
                `market:hot_cg`,
                300_000, // 5 min TTL
                async () => {
                    const apiUrl = `${CG_BASE}/coins/markets?vs_currency=usd&order=volume_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h`;
                    const res = await rateLimitedFetch(apiUrl, coingeckoLimiter, {
                        headers: { 'x-cg-demo-api-key': env.COINGECKO_API_KEY || '' }
                    });
                    if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
                    return await res.json();
                }
            );

            return json(data.slice(0, 20));
        }
    } catch (err: any) {
        console.error('[/api/market] Error:', err.message);
        return json({ error: err.message }, { status: 500 });
    }
};
