import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cachedFetch, coingeckoLimiter, rateLimitedFetch } from '$lib/server/apiCache';
import { COINGECKO_API_KEY } from '$env/static/private';

const BASE_URL = 'https://api.coingecko.com/api/v3';

export const GET: RequestHandler = async ({ url }) => {
    const q = url.searchParams.get('q') || '';

    if (!q || q.length < 1) {
        return json([]);
    }

    try {
        const data = await cachedFetch(
            `search:${q.toLowerCase()}`,
            300_000, // 5 min TTL
            async () => {
                const apiUrl = `${BASE_URL}/search?query=${encodeURIComponent(q)}`;

                const res = await rateLimitedFetch(apiUrl, coingeckoLimiter, {
                    headers: { 'x-cg-demo-api-key': COINGECKO_API_KEY }
                });

                if (!res.ok) {
                    throw new Error(`CoinGecko search error: ${res.status}`);
                }

                const result = await res.json();
                const coins = (result.coins || []).slice(0, 15);

                return coins.map((coin: any) => ({
                    id: coin.id,
                    name: coin.name,
                    symbol: coin.symbol,
                    thumb: coin.thumb,
                    large: coin.large,
                    market_cap_rank: coin.market_cap_rank,
                }));
            }
        );

        return json(data);
    } catch (err: any) {
        console.error('[/api/search] Error:', err.message);
        return json([]);
    }
};
