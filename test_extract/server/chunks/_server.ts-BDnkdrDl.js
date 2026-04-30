import { b as private_env } from './shared-server-9-2j12mp.js';
import { c as cachedFetch, r as rateLimitedFetch, b as binanceLimiter } from './apiCache-CuQsYDwh.js';
import { j as json } from './index-De89J4_m.js';
import './index-DBqjc0Yf.js';

//#region src/routes/api/market/+server.ts
var BINANCE_FAPI = "https://fapi.binance.com/fapi/v1";
var EXCLUDED_SUFFIXES = [
	"UP",
	"DOWN",
	"BULL",
	"BEAR"
];
var EXCLUDED_PAIRS = new Set([
	"USDCUSDT",
	"BUSDUSDT",
	"TUSDUSDT",
	"DAIUSDT",
	"FDUSDUSDT",
	"EURUSDT",
	"GBPUSDT",
	"AUDUSDT",
	"BRLUSDT",
	"TRYUSDT",
	"AEURUSDT",
	"USDPUSDT",
	"USTCUSDT"
]);
function isValidPair(symbol) {
	if (!symbol.endsWith("USDT")) return false;
	if (EXCLUDED_PAIRS.has(symbol)) return false;
	const base = symbol.replace("USDT", "");
	if (EXCLUDED_SUFFIXES.some((s) => base.endsWith(s))) return false;
	if (base.length < 2) return false;
	return true;
}
var GET = async ({ url }) => {
	const type = url.searchParams.get("type") || "hot";
	try {
		let filtered = (await cachedFetch(`market:binance_fapi_ticker`, 6e4, async () => {
			const res = await rateLimitedFetch(`${BINANCE_FAPI}/ticker/24hr`, binanceLimiter, { headers: private_env.BINANCE_API_KEY ? { "X-MBX-APIKEY": private_env.BINANCE_API_KEY } : {} });
			if (!res.ok) throw new Error(`Binance fapi error: ${res.status}`);
			return await res.json();
		})).filter((t) => {
			if (!isValidPair(t.symbol)) return false;
			return true;
		});
		if (type === "gainers") filtered.sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent));
		else if (type === "losers") filtered.sort((a, b) => parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent));
		else filtered.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
		return json(filtered.slice(0, 20).map((t) => {
			const base = t.symbol.replace("USDT", "");
			return {
				id: base.toLowerCase(),
				symbol: base.toLowerCase(),
				name: t.symbol.replace("USDT", "/USDT"),
				image: `https://cdn.jsdelivr.net/gh/nicholasgasior/cryptocurrency-icons@master/svg/color/${base.toLowerCase()}.svg`,
				current_price: parseFloat(t.lastPrice),
				price_change_percentage_24h: parseFloat(t.priceChangePercent),
				total_volume: parseFloat(t.quoteVolume),
				market_cap: null,
				binanceSymbol: t.symbol
			};
		}));
	} catch (err) {
		console.error("[/api/market] Error:", err.message);
		return json({ error: err.message }, { status: 500 });
	}
};

export { GET };
//# sourceMappingURL=_server.ts-BDnkdrDl.js.map
