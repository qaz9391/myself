import { b as private_env } from './shared-server-9-2j12mp.js';
import { c as cachedFetch, r as rateLimitedFetch, a as coingeckoLimiter } from './apiCache-CuQsYDwh.js';
import { j as json } from './index-De89J4_m.js';
import './index-DBqjc0Yf.js';

//#region src/routes/api/coin/+server.ts
var BASE_URL = "https://api.coingecko.com/api/v3";
var GET = async ({ url }) => {
	const id = url.searchParams.get("id") || "bitcoin";
	try {
		return json(await cachedFetch(`coin:${id}`, 3e5, async () => {
			const res = await rateLimitedFetch(`${BASE_URL}/coins/${id}?localization=false&tickers=false&community_data=true&developer_data=false&sparkline=false`, coingeckoLimiter, { headers: { "x-cg-demo-api-key": private_env.COINGECKO_API_KEY || "" } });
			if (!res.ok) throw new Error(`CoinGecko API error: ${res.status} ${res.statusText}`);
			const coin = await res.json();
			return {
				id: coin.id,
				symbol: coin.symbol,
				name: coin.name,
				image: coin.image?.large || coin.image?.small,
				description: coin.description?.en || "",
				links: {
					homepage: coin.links?.homepage?.[0] || "",
					twitter: coin.links?.twitter_screen_name ? `https://twitter.com/${coin.links.twitter_screen_name}` : "",
					reddit: coin.links?.subreddit_url || "",
					github: coin.links?.repos_url?.github?.[0] || ""
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
					atl: coin.market_data?.atl?.usd
				},
				community: {
					twitter_followers: coin.community_data?.twitter_followers,
					reddit_subscribers: coin.community_data?.reddit_subscribers
				},
				last_updated: coin.last_updated
			};
		}));
	} catch (err) {
		console.error("[/api/coin] Error:", err.message);
		return json({ error: err.message }, { status: 500 });
	}
};

export { GET };
//# sourceMappingURL=_server.ts-B7aW2qfD.js.map
