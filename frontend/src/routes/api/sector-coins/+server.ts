import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cachedFetch, coingeckoLimiter, rateLimitedFetch } from '$lib/server/apiCache';
import { env } from '$env/dynamic/private';

const BASE_URL = 'https://api.coingecko.com/api/v3';

export const GET: RequestHandler = async ({ url }) => {
    const categoryId = url.searchParams.get('category') || '';
    if (!categoryId) return json({ error: 'Missing category parameter' }, { status: 400 });

    try {
        const data = await cachedFetch(
            `sector-coins:${categoryId}`,
            300_000, // 5 min TTL
            async () => {
                const apiUrl = `${BASE_URL}/coins/markets?vs_currency=usd&category=${encodeURIComponent(categoryId)}&order=market_cap_desc&per_page=30&page=1&sparkline=true&price_change_percentage=24h,7d`;

                const res = await rateLimitedFetch(apiUrl, coingeckoLimiter, {
                    headers: { 'x-cg-demo-api-key': env.COINGECKO_API_KEY || '' }
                });

                if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
                const coins = await res.json();

                return coins.map((c: any) => ({
                    id: c.id,
                    symbol: c.symbol,
                    name: c.name,
                    image: c.image,
                    current_price: c.current_price,
                    market_cap: c.market_cap,
                    market_cap_rank: c.market_cap_rank,
                    total_volume: c.total_volume,
                    price_change_percentage_24h: c.price_change_percentage_24h,
                    price_change_percentage_7d: c.price_change_percentage_7d_in_currency,
                    sparkline_in_7d: c.sparkline_in_7d?.price || [],
                }));
            }
        );

        return json(data);
    } catch (err: any) {
        console.error('[/api/sector-coins] Error:', err.message);
        return json([]);
    }
};
