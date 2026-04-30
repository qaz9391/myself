import { b as private_env } from './shared-server-9-2j12mp.js';
import { c as cachedFetch, r as rateLimitedFetch, a as coingeckoLimiter } from './apiCache-CuQsYDwh.js';
import { j as json } from './index-De89J4_m.js';
import './index-DBqjc0Yf.js';

//#region src/routes/api/search/+server.ts
var BASE_URL = "https://api.coingecko.com/api/v3";
var GET = async ({ url }) => {
	const q = url.searchParams.get("q") || "";
	if (!q || q.length < 1) return json([]);
	try {
		return json(await cachedFetch(`search:${q.toLowerCase()}`, 3e5, async () => {
			const res = await rateLimitedFetch(`${BASE_URL}/search?query=${encodeURIComponent(q)}`, coingeckoLimiter, { headers: { "x-cg-demo-api-key": private_env.COINGECKO_API_KEY || "" } });
			if (!res.ok) throw new Error(`CoinGecko search error: ${res.status}`);
			return ((await res.json()).coins || []).slice(0, 15).map((coin) => ({
				id: coin.id,
				name: coin.name,
				symbol: coin.symbol,
				thumb: coin.thumb,
				large: coin.large,
				market_cap_rank: coin.market_cap_rank
			}));
		}));
	} catch (err) {
		console.error("[/api/search] Error:", err.message);
		return json([]);
	}
};

export { GET };
//# sourceMappingURL=_server.ts-Cy9A1V_n.js.map
