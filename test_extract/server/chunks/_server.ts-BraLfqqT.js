import { b as private_env } from './shared-server-9-2j12mp.js';
import { c as cachedFetch, r as rateLimitedFetch, b as binanceLimiter } from './apiCache-CuQsYDwh.js';
import { j as json } from './index-De89J4_m.js';
import './index-DBqjc0Yf.js';

//#region src/routes/api/squeeze/+server.ts
var BINANCE_BASE = "https://api.binance.com";
var EXCLUDED = new Set([
	"USDCUSDT",
	"BUSDUSDT",
	"TUSDUSDT",
	"DAIUSDT",
	"FDUSDUSDT",
	"EURUSDT"
]);
async function getTopSymbols() {
	return cachedFetch("squeeze:top_symbols", 6e5, async () => {
		const res = await rateLimitedFetch(`${BINANCE_BASE}/api/v3/ticker/24hr`, binanceLimiter);
		if (!res.ok) throw new Error("Failed to fetch ticker");
		return (await res.json()).filter((t) => {
			const s = t.symbol;
			if (!s.endsWith("USDT")) return false;
			if (EXCLUDED.has(s)) return false;
			const base = s.replace("USDT", "");
			if (base.endsWith("UP") || base.endsWith("DOWN")) return false;
			if (base.length < 2) return false;
			return true;
		}).sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)).slice(0, 100).map((t) => t.symbol);
	});
}
function linearRegression(y) {
	const n = y.length;
	let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
	for (let i = 0; i < n; i++) {
		sumX += i;
		sumY += y[i];
		sumXY += i * y[i];
		sumXX += i * i;
	}
	return { slope: (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) };
}
function identifyPattern(highs, lows) {
	if (highs.length < 5) return {
		type: "none",
		direction: "neutral",
		char: ""
	};
	const h0 = highs[0] || 1;
	const l0 = lows[0] || 1;
	const normHighs = highs.map((h) => h / h0);
	const normLows = lows.map((l) => l / l0);
	const hs = linearRegression(normHighs).slope;
	const ls = linearRegression(normLows).slope;
	if (Math.abs(hs) < 5e-4 && ls > .001) return {
		type: "ascending_triangle",
		direction: "up",
		char: "▲"
	};
	if (Math.abs(ls) < 5e-4 && hs < -1e-3) return {
		type: "descending_triangle",
		direction: "down",
		char: "▼"
	};
	if (hs < -1e-3 && ls > .001) return {
		type: "symmetrical_triangle",
		direction: "neutral",
		char: "◆"
	};
	if (Math.abs(hs) <= 5e-4 && Math.abs(ls) <= 5e-4) return {
		type: "rectangle",
		direction: "neutral",
		char: "■"
	};
	return {
		type: "none",
		direction: "neutral",
		char: ""
	};
}
function isVolumeContracted(volumes, windowSize = 5) {
	if (volumes.length < windowSize * 3) return {
		contracted: false,
		ratioStr: "",
		ratio: 100
	};
	const recent = volumes.slice(-windowSize);
	const baseline = volumes.slice(-windowSize * 3, -windowSize);
	const recentAvg = recent.reduce((a, b) => a + b, 0) / windowSize;
	const baselineAvg = baseline.reduce((a, b) => a + b, 0) / (windowSize * 2) || 1;
	const contracted = recentAvg < baselineAvg * .7;
	const ratio = recentAvg / baselineAvg * 100;
	return {
		contracted,
		ratio,
		ratioStr: ratio.toFixed(1) + "%"
	};
}
function calculateSqueeze(data) {
	const sqzLen = 20;
	const sqzMinBars = 5;
	const bbMult = 2;
	const kcMult = 1.29;
	if (data.length < sqzLen + 1) return {
		isSqueeze: false,
		count: 0,
		price: 0,
		pattern: {
			type: "none",
			direction: "neutral",
			char: ""
		},
		volumeAlert: {
			contracted: false,
			ratioStr: "",
			ratio: 100
		},
		emaTrend: "neutral"
	};
	const closes = data.map((d) => d[4]);
	const highs = data.map((d) => d[2]);
	const lows = data.map((d) => d[3]);
	const volumes = data.map((d) => d[5]);
	const sma = (arr, len, idx) => {
		let sum = 0;
		for (let i = idx - len + 1; i <= idx; i++) sum += arr[i];
		return sum / len;
	};
	const stdev = (arr, len, idx) => {
		const mean = sma(arr, len, idx);
		let sumSq = 0;
		for (let i = idx - len + 1; i <= idx; i++) sumSq += (arr[i] - mean) ** 2;
		return Math.sqrt(sumSq / len);
	};
	const trueRange = (i) => {
		if (i === 0) return highs[i] - lows[i];
		return Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
	};
	let sqzCount = 0;
	let lastIdx = closes.length - 1;
	for (let i = lastIdx; i >= sqzLen; i--) {
		const s = sma(closes, sqzLen, i);
		const sd = stdev(closes, sqzLen, i);
		const upperBB = s + bbMult * sd;
		const lowerBB = s - bbMult * sd;
		let trSum = 0;
		for (let j = i - sqzLen + 1; j <= i; j++) trSum += trueRange(j);
		const rangeMa = trSum / sqzLen;
		const upperKC = s + kcMult * rangeMa;
		const isSqz = lowerBB > s - kcMult * rangeMa && upperBB < upperKC;
		if (i === lastIdx) sqzCount = isSqz ? 1 : 0;
		else if (isSqz) sqzCount++;
		else break;
	}
	const calcEMA = (period) => {
		if (closes.length < period) return closes[closes.length - 1];
		let k = 2 / (period + 1);
		let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
		for (let i = period; i <= lastIdx; i++) ema = (closes[i] - ema) * k + ema;
		return ema;
	};
	let emaTrend = "neutral";
	if (sqzCount >= sqzMinBars || closes.length >= 200) {
		const ema21 = calcEMA(21);
		const ema55 = calcEMA(55);
		const ema200 = calcEMA(200);
		if (ema21 > ema55 && ema55 > ema200) emaTrend = "bullish";
		else if (ema21 < ema55 && ema55 < ema200) emaTrend = "bearish";
	}
	let pattern = {
		type: "none",
		direction: "neutral",
		char: ""
	};
	let volumeAlert = {
		contracted: false,
		ratioStr: "",
		ratio: 100
	};
	if (sqzCount >= sqzMinBars) {
		const lookback = Math.min(sqzCount, 30);
		const sqzHighs = highs.slice(lastIdx - lookback + 1, lastIdx + 1);
		const sqzLows = lows.slice(lastIdx - lookback + 1, lastIdx + 1);
		const sqzVols = volumes.slice(lastIdx - lookback * 2, lastIdx + 1);
		pattern = identifyPattern(sqzHighs, sqzLows);
		volumeAlert = isVolumeContracted(sqzVols, Math.max(5, Math.floor(lookback / 2)));
	}
	return {
		isSqueeze: sqzCount >= sqzMinBars,
		count: sqzCount,
		price: closes[lastIdx],
		pattern,
		volumeAlert,
		emaTrend
	};
}
var GET = async ({ url }) => {
	const timeframe = url.searchParams.get("timeframe") || "4h";
	const tf = [
		"1h",
		"4h",
		"1d"
	].includes(timeframe) ? timeframe : "4h";
	try {
		return json(await cachedFetch(`squeeze:${tf}`, 3e5, async () => {
			const tasks = (await getTopSymbols()).map(async (symbol) => {
				try {
					const res = await rateLimitedFetch(`${BINANCE_BASE}/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=300`, binanceLimiter, { headers: private_env.BINANCE_API_KEY ? { "X-MBX-APIKEY": private_env.BINANCE_API_KEY } : {} });
					if (res.ok) {
						const squeeze = calculateSqueeze((await res.json()).map((k) => k.map(Number)));
						if (squeeze.isSqueeze) return {
							symbol: symbol.replace("USDT", "/USDT"),
							binanceSymbol: symbol,
							count: squeeze.count,
							price: squeeze.price,
							timeframe: tf,
							pattern: squeeze.pattern,
							volumeAlert: squeeze.volumeAlert,
							emaTrend: squeeze.emaTrend
						};
					}
				} catch (e) {
					console.error(`[squeeze] Error scanning ${symbol}:`, e);
				}
				return null;
			});
			return (await Promise.all(tasks)).filter((r) => r !== null).sort((a, b) => b.count - a.count);
		}));
	} catch (err) {
		console.error("[/api/squeeze] Error:", err.message);
		return json([]);
	}
};

export { GET };
//# sourceMappingURL=_server.ts-BraLfqqT.js.map
