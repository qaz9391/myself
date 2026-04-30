import { j as json } from './index-De89J4_m.js';
import './index-DBqjc0Yf.js';

//#region src/routes/api/kline/+server.ts
var GET = async ({ url }) => {
	const symbol = url.searchParams.get("symbol") || "BTCUSDT";
	const interval = url.searchParams.get("interval") || "4h";
	const limit = url.searchParams.get("limit") || "300";
	try {
		const apiUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
		const res = await fetch(apiUrl);
		if (!res.ok) return json({ error: `Binance returned ${res.status}` }, { status: res.status });
		return json((await res.json()).map((k) => ({
			time: Math.floor(k[0] / 1e3),
			open: parseFloat(k[1]),
			high: parseFloat(k[2]),
			low: parseFloat(k[3]),
			close: parseFloat(k[4]),
			volume: parseFloat(k[5])
		})));
	} catch (err) {
		return json({ error: err.message }, { status: 500 });
	}
};

export { GET };
//# sourceMappingURL=_server.ts-D_MmK_9B.js.map
