//#region src/lib/server/apiCache.ts
var cache = /* @__PURE__ */ new Map();
/**
* Get cached data or fetch fresh data
* @param key - Cache key
* @param ttlMs - Time-to-live in milliseconds
* @param fetchFn - Async function to fetch fresh data
*/
async function cachedFetch(key, ttlMs, fetchFn) {
	const existing = cache.get(key);
	if (existing && Date.now() - existing.timestamp < existing.ttl) {
		console.log(`[Cache HIT] ${key}`);
		return existing.data;
	}
	console.log(`[Cache MISS] ${key} — fetching fresh data...`);
	const data = await fetchFn();
	cache.set(key, {
		data,
		timestamp: Date.now(),
		ttl: ttlMs
	});
	return data;
}
var RateLimiter = class {
	queue = [];
	tokens;
	maxTokens;
	refillRate;
	lastRefill;
	constructor(maxRequestsPerMinute) {
		this.maxTokens = maxRequestsPerMinute;
		this.tokens = maxRequestsPerMinute;
		this.refillRate = maxRequestsPerMinute / 6e4;
		this.lastRefill = Date.now();
	}
	refill() {
		const now = Date.now();
		const elapsed = now - this.lastRefill;
		this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
		this.lastRefill = now;
	}
	async acquire() {
		this.refill();
		if (this.tokens >= 1) {
			this.tokens -= 1;
			return;
		}
		const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
		return new Promise((resolve) => {
			setTimeout(() => {
				this.refill();
				this.tokens -= 1;
				resolve();
			}, waitMs);
		});
	}
};
var binanceLimiter = new RateLimiter(120);
var coingeckoLimiter = new RateLimiter(25);
var cryptocompareLimiter = new RateLimiter(50);
/**
* Fetch with rate limiting
*/
async function rateLimitedFetch(url, limiter, options) {
	await limiter.acquire();
	return fetch(url, options);
}
setInterval(() => {
	const now = Date.now();
	for (const [key, entry] of cache.entries()) if (now - entry.timestamp > entry.ttl * 2) cache.delete(key);
}, 6e4);

export { coingeckoLimiter as a, binanceLimiter as b, cachedFetch as c, cryptocompareLimiter as d, rateLimitedFetch as r };
//# sourceMappingURL=apiCache-CuQsYDwh.js.map
