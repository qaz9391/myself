import { b as private_env } from './shared-server-9-2j12mp.js';
import { c as cachedFetch, r as rateLimitedFetch, a as coingeckoLimiter } from './apiCache-CuQsYDwh.js';
import { j as json } from './index-De89J4_m.js';
import './index-DBqjc0Yf.js';

//#region src/routes/api/sectors/+server.ts
var BASE_URL = "https://api.coingecko.com/api/v3";
var GET = async ({ url }) => {
	const order = url.searchParams.get("order") || "market_cap_desc";
	try {
		return json(await cachedFetch(`sectors:${order}`, 3e5, async () => {
			const res = await rateLimitedFetch(`${BASE_URL}/coins/categories?order=${order}`, coingeckoLimiter, { headers: { "x-cg-demo-api-key": private_env.COINGECKO_API_KEY || "" } });
			if (!res.ok) throw new Error(`CoinGecko categories error: ${res.status}`);
			return (await res.json()).slice(0, 30).map((cat) => ({
				id: cat.id,
				name: cat.name,
				market_cap: cat.market_cap,
				market_cap_change_24h: cat.market_cap_change_24h,
				volume_24h: cat.volume_24h,
				top_3_coins: cat.top_3_coins || [],
				top_3_coins_id: cat.top_3_coins_id || [],
				updated_at: cat.updated_at
			}));
		}));
	} catch (err) {
		console.error("[/api/sectors] Error:", err.message);
		return json([]);
	}
};

export { GET };
//# sourceMappingURL=_server.ts-BaIuOLjL.js.map
