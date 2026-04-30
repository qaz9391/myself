import { b as private_env } from './shared-server-9-2j12mp.js';
import { c as cachedFetch, r as rateLimitedFetch, a as coingeckoLimiter } from './apiCache-CuQsYDwh.js';
import { j as json } from './index-De89J4_m.js';
import './index-DBqjc0Yf.js';

//#region src/routes/api/sector-coins/+server.ts
var BASE_URL = "https://api.coingecko.com/api/v3";
var GET = async ({ url }) => {
	const categoryId = url.searchParams.get("category") || "";
	if (!categoryId) return json({ error: "Missing category parameter" }, { status: 400 });
	try {
		return json(await cachedFetch(`sector-coins:${categoryId}`, 3e5, async () => {
			const res = await rateLimitedFetch(`${BASE_URL}/coins/markets?vs_currency=usd&category=${encodeURIComponent(categoryId)}&order=market_cap_desc&per_page=30&page=1&sparkline=true&price_change_percentage=24h,7d`, coingeckoLimiter, { headers: { "x-cg-demo-api-key": private_env.COINGECKO_API_KEY || "" } });
			if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
			return (await res.json()).map((c) => ({
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
				sparkline_in_7d: c.sparkline_in_7d?.price || []
			}));
		}));
	} catch (err) {
		console.error("[/api/sector-coins] Error:", err.message);
		return json([]);
	}
};

export { GET };
//# sourceMappingURL=_server.ts-BK62rJrv.js.map
