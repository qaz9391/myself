import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cachedFetch, coingeckoLimiter, rateLimitedFetch } from '$lib/server/apiCache';
import { env } from '$env/dynamic/private';

const BASE_URL = 'https://api.coingecko.com/api/v3';

export const GET: RequestHandler = async ({ url }) => {
    const id = url.searchParams.get('id') || 'bitcoin';

    try {
        const data = await cachedFetch(
            `coin:${id}`,
            300_000, // 5 min TTL
            async () => {
                const apiUrl = `${BASE_URL}/coins/${id}?localization=false&tickers=false&community_data=true&developer_data=false&sparkline=false`;

                const res = await rateLimitedFetch(apiUrl, coingeckoLimiter, {
                    headers: { 'x-cg-demo-api-key': env.COINGECKO_API_KEY || '' }
                });

                if (!res.ok) {
                    throw new Error(`CoinGecko API error: ${res.status} ${res.statusText}`);
                }

                const coin = await res.json();

                // Return a clean subset of data
                return {
                    id: coin.id,
                    symbol: coin.symbol,
                    name: coin.name,
                    image: coin.image?.large || coin.image?.small,
                    description: coin.description?.en || '',
                    links: {
                        homepage: coin.links?.homepage?.[0] || '',
                        twitter: coin.links?.twitter_screen_name ? `https://twitter.com/${coin.links.twitter_screen_name}` : '',
                        reddit: coin.links?.subreddit_url || '',
                        github: coin.links?.repos_url?.github?.[0] || '',
                    },
                    market_data: {
                        current_price: coin.market_data?.current_price?.usd,
                        market_cap: coin.market_data?.market_cap?.usd,
                        total_volume: coin.market_data?.total_volume?.usd,
                        high_24h: coin.market_data?.high_24h?.usd,
                        low_24h: coin.market_data?.low_24h?.usd,
                        price_change_24h: coin.market_data?.price_change_24h,
                        price_change_percentage_24h: coin.market_data?.price_change_percentage_24h,
                        price_change_percentage_7d: coin.market_data?.price_change_percentage_7d,
                        price_change_percentage_30d: coin.market_data?.price_change_percentage_30d,
                        market_cap_rank: coin.market_data?.market_cap_rank || coin.market_cap_rank,
                        circulating_supply: coin.market_data?.circulating_supply,
                        total_supply: coin.market_data?.total_supply,
                        max_supply: coin.market_data?.max_supply,
                        ath: coin.market_data?.ath?.usd,
                        ath_change_percentage: coin.market_data?.ath_change_percentage?.usd,
                        atl: coin.market_data?.atl?.usd,
                    },
                    community: {
                        twitter_followers: coin.community_data?.twitter_followers,
                        reddit_subscribers: coin.community_data?.reddit_subscribers,
                    },
                    last_updated: coin.last_updated,
                };
            }
        );

        return json(data);
    } catch (err: any) {
        console.error('[/api/coin] Error:', err.message);
        return json({ error: err.message }, { status: 500 });
    }
};
