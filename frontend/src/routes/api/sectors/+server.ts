import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cachedFetch, coingeckoLimiter, rateLimitedFetch } from '$lib/server/apiCache';
import { env } from '$env/dynamic/private';

const BASE_URL = 'https://api.coingecko.com/api/v3';

export const GET: RequestHandler = async ({ url }) => {
    const order = url.searchParams.get('order') || 'market_cap_desc';

    try {
        const data = await cachedFetch(
            `sectors:${order}`,
            300_000, // 5 min TTL
            async () => {
                const apiUrl = `${BASE_URL}/coins/categories?order=${order}`;

                const res = await rateLimitedFetch(apiUrl, coingeckoLimiter, {
                    headers: { 'x-cg-demo-api-key': env.COINGECKO_API_KEY || '' }
                });

                if (!res.ok) {
                    throw new Error(`CoinGecko categories error: ${res.status}`);
                }

                const categories = await res.json();

                // Return top 30 categories with relevant data
                return categories.slice(0, 30).map((cat: any) => ({
                    id: cat.id,
                    name: cat.name,
                    market_cap: cat.market_cap,
                    market_cap_change_24h: cat.market_cap_change_24h,
                    volume_24h: cat.volume_24h,
                    top_3_coins: cat.top_3_coins || [],
                    top_3_coins_id: cat.top_3_coins_id || [],
                    updated_at: cat.updated_at,
                }));
            }
        );

        return json(data);
    } catch (err: any) {
        console.error('[/api/sectors] Error:', err.message);
        return json([]);
    }
};
