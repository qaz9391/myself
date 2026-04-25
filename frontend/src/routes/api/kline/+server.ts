import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { binanceLimiter, cachedFetch, rateLimitedFetch } from '$lib/server/apiCache';
import { env } from '$env/dynamic/private';

const BINANCE_BASES = [
    'https://api.binance.com',
    'https://api1.binance.com',
    'https://api2.binance.com',
    'https://api3.binance.com'
];

export const GET: RequestHandler = async ({ url }) => {
    const symbol = url.searchParams.get('symbol') || 'BTCUSDT';
    const interval = url.searchParams.get('interval') || '4h';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '200'), 1000);

    try {
        const data = await cachedFetch(
            `kline:${symbol}:${interval}:${limit}`,
            60_000, // 1 min TTL
            async () => {
                let lastError = null;

                // Try different Binance bases and with/without key
                for (const base of BINANCE_BASES) {
                    const apiUrl = `${base}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

                    const apiKey = env.BINANCE_API_KEY;
                    // Try with Key first
                    try {
                        const res = await rateLimitedFetch(apiUrl, binanceLimiter, {
                            headers: apiKey ? { 'X-MBX-APIKEY': apiKey } : {}
                        });
                        if (res.ok) return await res.json();
                        
                        // If 401/403, Key might be invalid or IP restricted, try without Key on next loop or same base
                        if (res.status === 401 || res.status === 403) {
                             const resNoKey = await rateLimitedFetch(apiUrl, binanceLimiter);
                             if (resNoKey.ok) return await resNoKey.json();
                        }
                    } catch (e) {
                        lastError = e;
                    }
                }
                throw lastError || new Error('All Binance endpoints failed');
            }
        );

        // Format for Lightweight Charts: { time, open, high, low, close, volume }
        const formatted = (data as any[]).map((k: any[]) => ({
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
