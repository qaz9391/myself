import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cachedFetch, cryptocompareLimiter, rateLimitedFetch } from '$lib/server/apiCache';
import { CRYPTOCOMPARE_API_KEY } from '$env/static/private';

const BASE_URL = 'https://min-api.cryptocompare.com/data/v2/news/';

export const GET: RequestHandler = async ({ url }) => {
    const categories = url.searchParams.get('categories') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

    try {
        const data = await cachedFetch(
            `news:${categories}:${limit}`,
            600_000, // 10 min TTL
            async () => {
                let apiUrl = `${BASE_URL}?lang=EN&sortOrder=latest`;
                if (categories) {
                    apiUrl += `&categories=${categories}`;
                }

                const res = await rateLimitedFetch(apiUrl, cryptocompareLimiter, {
                    headers: { 'authorization': `Apikey ${CRYPTOCOMPARE_API_KEY}` }
                });

                if (!res.ok) {
                    throw new Error(`CryptoCompare API error: ${res.status} ${res.statusText}`);
                }

                const result = await res.json();
                const articles = (result.Data || []).slice(0, limit);

                return articles.map((article: any) => ({
                    id: article.id,
                    title: article.title,
                    body: article.body?.substring(0, 200) + '...',
                    url: article.url,
                    imageurl: article.imageurl,
                    source: article.source,
                    categories: article.categories,
                    published_on: article.published_on,
                }));
            }
        );

        return json(data);
    } catch (err: any) {
        console.error('[/api/news] Error:', err.message);
        // Return empty array on error so UI doesn't break
        return json([]);
    }
};
