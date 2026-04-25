// Server-side in-memory cache with TTL and request queue
// Prevents excessive API calls to external services

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Get cached data or fetch fresh data
 * @param key - Cache key
 * @param ttlMs - Time-to-live in milliseconds
 * @param fetchFn - Async function to fetch fresh data
 */
export async function cachedFetch<T>(
    key: string,
    ttlMs: number,
    fetchFn: () => Promise<T>
): Promise<T> {
    const existing = cache.get(key) as CacheEntry<T> | undefined;

    if (existing && Date.now() - existing.timestamp < existing.ttl) {
        console.log(`[Cache HIT] ${key}`);
        return existing.data;
    }

    console.log(`[Cache MISS] ${key} — fetching fresh data...`);
    const data = await fetchFn();

    cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl: ttlMs,
    });

    return data;
}

// ---- Rate Limiter for Binance ----
// Binance allows 6000 weight/min. Most endpoints are weight=1-10.
// We'll limit to ~20 requests per 10 seconds to stay safe.

interface QueueItem {
    resolve: (value: void) => void;
    timestamp: number;
}

class RateLimiter {
    private queue: QueueItem[] = [];
    private tokens: number;
    private maxTokens: number;
    private refillRate: number; // tokens per ms
    private lastRefill: number;

    constructor(maxRequestsPerMinute: number) {
        this.maxTokens = maxRequestsPerMinute;
        this.tokens = maxRequestsPerMinute;
        this.refillRate = maxRequestsPerMinute / 60000;
        this.lastRefill = Date.now();
    }

    private refill() {
        const now = Date.now();
        const elapsed = now - this.lastRefill;
        this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;
    }

    async acquire(): Promise<void> {
        this.refill();

        if (this.tokens >= 1) {
            this.tokens -= 1;
            return;
        }

        // Wait until a token is available
        const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
        return new Promise((resolve) => {
            setTimeout(() => {
                this.refill();
                this.tokens -= 1;
                resolve();
            }, waitMs);
        });
    }
}

// Create rate limiters for different APIs
export const binanceLimiter = new RateLimiter(120); // 120 req/min (conservative)
export const coingeckoLimiter = new RateLimiter(25); // 25 req/min (demo limit is 30)
export const cryptocompareLimiter = new RateLimiter(50); // 50 req/min

/**
 * Fetch with rate limiting
 */
export async function rateLimitedFetch(
    url: string,
    limiter: RateLimiter,
    options?: RequestInit
): Promise<Response> {
    await limiter.acquire();
    return fetch(url, options);
}

// Clean up expired cache entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > entry.ttl * 2) {
            cache.delete(key);
        }
    }
}, 60000); // Every 60 seconds
