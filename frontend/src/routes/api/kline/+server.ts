import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { binanceLimiter, cachedFetch, rateLimitedFetch } from '$lib/server/apiCache';
import { BINANCE_API_KEY } from '$env/static/private';

const BINANCE_BASE = 'https://api.binance.com';

export const GET: RequestHandler = async ({ url }) => {
    const symbol = url.searchParams.get('symbol') || 'BTCUSDT';
    const interval = url.searchParams.get('interval') || '4h';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '200'), 1000);

    try {
        const data = await cachedFetch(
            `kline:${symbol}:${interval}:${limit}`,
            60_000, // 1 min TTL
            async () => {
                const apiUrl = `${BINANCE_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

                const res = await rateLimitedFetch(apiUrl, binanceLimiter, {
                    headers: { 'X-MBX-APIKEY': BINANCE_API_KEY }
                });

                if (!res.ok) {
                    throw new Error(`Binance API error: ${res.status} ${res.statusText}`);
                }

                const rawData = await res.json();

                // Format for Lightweight Charts: { time, open, high, low, close, volume }
                return rawData.map((k: any[]) => ({
                    time: Math.floor(k[0] / 1000), // Convert ms to seconds (UNIX timestamp)
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4]),
                    volume: parseFloat(k[5]),
                }));
            }
        );

        return json(data);
    } catch (err: any) {
        console.error('[/api/kline] Error:', err.message);
        return json({ error: err.message }, { status: 500 });
    }
};
