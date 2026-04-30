import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cachedFetch, cryptocompareLimiter, rateLimitedFetch } from '$lib/server/apiCache';
import { env } from '$env/dynamic/private';
import Parser from 'rss-parser';

const parser = new Parser();
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
                    headers: { 'authorization': `Apikey ${env.CRYPTOCOMPARE_API_KEY || ''}` }
                });

                if (!res.ok) {
                    throw new Error(`CryptoCompare API error: ${res.status} ${res.statusText}`);
                }

                const result = await res.json();
                const dataArr = Array.isArray(result.Data) ? result.Data : (Array.isArray(result) ? result : []);
                const articles = dataArr.slice(0, limit);
                
                if (articles.length === 0) {
                    console.log('[/api/news] Empty data received from CryptoCompare.');
                }

                const ccArticles = articles.map((article: any) => ({
                    id: article.id,
                    title: article.title,
                    body: article.body?.substring(0, 200) + '...',
                    url: article.url,
                    imageurl: article.imageurl,
                    source: article.source,
                    categories: article.categories,
                    published_on: article.published_on,
                    isBreaking: false
                }));

                // Fetch Chinese News (Jin10 & PANews) via public RSSHub
                let zhArticles: any[] = [];
                try {
                    const rssUrls = [
                        'https://rsshub.app/jin10/telegraph', // 金十快訊
                        'https://rsshub.app/panewslab/news'   // PANews
                    ];
                    
                    for (const rssUrl of rssUrls) {
                        try {
                            const feed = await parser.parseURL(rssUrl);
                            const items = feed.items.slice(0, 8).map((item, index) => ({
                                id: `rss-${Date.now()}-${index}`,
                                title: item.title?.replace(/<[^>]+>/g, ''), // strip HTML
                                body: item.contentSnippet?.substring(0, 200) + '...',
                                url: item.link,
                                imageurl: '',
                                source: rssUrl.includes('jin10') ? '金十數據' : 'PANews',
                                categories: 'Crypto|Macro',
                                published_on: item.pubDate ? Math.floor(new Date(item.pubDate).getTime() / 1000) : Math.floor(Date.now() / 1000),
                                isBreaking: true // Rss items as breaking for marquee
                            }));
                            zhArticles = [...zhArticles, ...items];
                        } catch (e) {
                            console.error('Failed to parse RSS:', rssUrl, e);
                        }
                    }
                } catch(e) {
                    console.log('RSS Fetch failed', e);
                }

                // Combine and sort by timestamp
                const combined = [...zhArticles, ...ccArticles].sort((a, b) => b.published_on - a.published_on);
                return combined.slice(0, limit);
            }
        );

        // Don't cache empty results from errors for long
        if (data.length === 0) {
            // We can't un-cache from here easily but at least we know it's empty
        }

        return json(data);
    } catch (err: any) {
        console.error('[/api/news] Error:', err.message);
        // Return empty array on error so UI doesn't break
        return json([]);
    }
};
