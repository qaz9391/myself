// [DEPENDENCY INFO] IDB requires manual setup natively since we are in standard browser JS.
export type ZoneType = 'Wall' | 'Void' | 'Trap';

// --- R4-7-A: Clock Sync Manager ---
// Corrects local clock bias vs exchange server clock (NTP jumps, etc.)
class ClockSyncManager {
    clockOffset = 0; // positive = local is ahead of server
    private lastSyncTime = 0;
    private readonly SYNC_INTERVAL_MS = 30 * 60 * 1000; // every 30 min

    async syncWithBinance(): Promise<void> {
        try {
            const t1 = Date.now();
            const res = await fetch('https://api.binance.com/api/v3/time');
            const t2 = Date.now();
            const data = await res.json();
            const rtt = t2 - t1;
            const estimatedServerTimeAtT1 = data.serverTime - rtt / 2;
            this.clockOffset = estimatedServerTimeAtT1 - t1;
            this.lastSyncTime = Date.now();
        } catch { /* fail silently, keep old offset */ }
    }

    getCorrectedNow(): number {
        if (typeof window !== 'undefined' && Date.now() - this.lastSyncTime > this.SYNC_INTERVAL_MS) {
            this.syncWithBinance();
        }
        return Date.now() + this.clockOffset;
    }
}
export const clockSync = new ClockSyncManager();

// --- R4-7-B: Latency Monitor with Hysteresis Recovery ---
class LatencyMonitor {
    private latencies: Record<string, number[]> = {};
    private isAnomalous = false;
    private recoveryStartTime: number | null = null;
    private readonly ANOMALY_THRESHOLD_MS = 3000;
    private readonly RECOVERY_THRESHOLD_MS = 1000;
    private readonly RECOVERY_DURATION_MS  = 60_000;

    record(exchange: string, latencyMs: number): void {
        if (latencyMs < 0 || latencyMs > 10_000) return; // filter garbage
        if (!this.latencies[exchange]) this.latencies[exchange] = [];
        this.latencies[exchange].push(latencyMs);
        if (this.latencies[exchange].length > 100) this.latencies[exchange].shift();
    }

    getP95(exchange: string): number {
        const arr = [...(this.latencies[exchange] || [])].sort((a, b) => a - b);
        if (arr.length === 0) return 0;
        return arr[Math.floor(arr.length * 0.95)];
    }

    /** Returns entity match window in ms; 0 = anomalous, skip cross-exchange matching */
    getMatchWindow(): number {
        const maxP95 = Math.max(
            this.getP95('binance'), this.getP95('bybit'), this.getP95('okx'), 100
        );
        if (!this.isAnomalous) {
            if (maxP95 > this.ANOMALY_THRESHOLD_MS) {
                this.isAnomalous = true;
                this.recoveryStartTime = null;
            }
            return Math.min(3000, maxP95 + 500);
        }
        // Hysteresis: must stay below RECOVERY_THRESHOLD for RECOVERY_DURATION to exit anomaly
        if (maxP95 <= this.RECOVERY_THRESHOLD_MS) {
            if (!this.recoveryStartTime) this.recoveryStartTime = Date.now();
            else if (Date.now() - this.recoveryStartTime >= this.RECOVERY_DURATION_MS) {
                this.isAnomalous = false;
                this.recoveryStartTime = null;
            }
        } else {
            this.recoveryStartTime = null; // reset if latency spikes again
        }
        return this.isAnomalous ? 0 : Math.min(3000, maxP95 + 500);
    }

    get anomalyActive(): boolean { return this.isAnomalous; }
}
export const latencyMonitor = new LatencyMonitor();

// --- R4-2-A/B/C: Iceberg Detector ---
interface RefillRecord {
    count: number;
    lastRefillTime: number;
}
interface WallLifecycle {
    lastDisappearTime: number;
    lastQty: number;
    exchange: string;
}
class IcebergDetector {
    private wallHistory = new Map<string, RefillRecord>();
    private wallLifecycles = new Map<string, WallLifecycle>();
    private readonly MAX_GAP_MS = 30_000;
    private readonly DECAY_AFTER_MS = 24 * 60 * 60 * 1000;
    // R4-2-C: track per-exchange disconnect times
    private disconnectTimes = new Map<string, number>();

    onExchangeDisconnect(exchange: string): void { this.disconnectTimes.set(exchange, Date.now()); }
    onExchangeReconnect(exchange: string): void { /* leave time so we can compute duration */ }

    /** R4-2-A: key includes symbol+side to prevent cross-symbol collisions */
    private normalizeKey(side: string, price: number, symbol: string, exchange: string): string {
        const grid = price > 10000 ? 50 : price > 1000 ? 5 : price > 100 ? 0.5 : 0.05;
        const gridPrice = Math.round(price / grid) * grid;
        return `${symbol}_${exchange}_${side}_${gridPrice}`;
    }

    /** R4-2-B: returns decay-adjusted refill count */
    getRefillCount(side: string, price: number, symbol: string, exchange: string): number {
        const key = this.normalizeKey(side, price, symbol, exchange);
        const record = this.wallHistory.get(key);
        if (!record) return 0;
        const age = Date.now() - record.lastRefillTime;
        if (age > this.DECAY_AFTER_MS) { this.wallHistory.delete(key); return 0; }
        if (age > 6 * 3600_000) {
            const decay = 1 - (age - 6 * 3600_000) / (18 * 3600_000);
            return Math.floor(record.count * decay);
        }
        return record.count;
    }

    /** Called when a wall appears; detects refill and increments count. Returns new refill count. */
    onWallAppear(side: string, price: number, qty: number, symbol: string, exchange: string): number {
        const key = this.normalizeKey(side, price, symbol, exchange);
        const lc  = this.wallLifecycles.get(key);

        if (lc) {
            const disconnectDuration = this.disconnectTimes.get(exchange)
                ? Date.now() - (this.disconnectTimes.get(exchange) ?? 0)
                : 0;
            const effectiveMaxGap = disconnectDuration > 0
                ? Math.max(this.MAX_GAP_MS, disconnectDuration + 60_000)
                : this.MAX_GAP_MS;
            const gapMs = Date.now() - lc.lastDisappearTime;
            if (gapMs <= effectiveMaxGap) {
                const record = this.wallHistory.get(key) || { count: 0, lastRefillTime: 0 };
                record.count++;
                record.lastRefillTime = Date.now();
                this.wallHistory.set(key, record);
            }
        }
        this.wallLifecycles.delete(key);
        return this.getRefillCount(side, price, symbol, exchange);
    }

    /** Called when a wall disappears */
    onWallDisappear(side: string, price: number, qty: number, symbol: string, exchange: string): void {
        const key = this.normalizeKey(side, price, symbol, exchange);
        this.wallLifecycles.set(key, { lastDisappearTime: Date.now(), lastQty: qty, exchange });
    }
}
export const icebergDetector = new IcebergDetector();

export interface ZoneData {
    top: number;
    bottom: number;
    heat: number;      
    type: ZoneType;
    side: 'Buy' | 'Sell';
    spoofScore?: number;
    reactionScore?: number;
    firstSeenMs?: number;
    totalUsd?: number;
    // V4 Confidence & State
    confidence?: 'HIGH' | 'MED' | 'LOW';
    persistenceState?: 'PENDING' | 'CONFIRMED';
}

export interface RawOrder {
    exchange: string;
    symbol: string;
    side: 'Buy' | 'Sell';
    price: number;
    usd: number;
    timestamp: number;
}

export interface TradeOrder {
    exchange: string;
    symbol: string;
    price: number;
    usd: number;
    timestamp: number;
}

export interface Entity {
    id: string; // Internal unique ID
    exchange: string; // Isolated per exchange
    symbol: string;
    side: 'Buy' | 'Sell';
    prices: number[]; 
    avgPrice: number;
    
    totalUsd: number;
    prevUsd: number;      
    
    firstSeenMs: number;
    lastSeenMs: number;
    createdAtMs: number;

    // History for Spoof
    disappearedCount: number;
    lifetimeTotalMs: number;
    
    // Extrema for Initiative
    minPriceObjObserved: number; 
    maxPriceObjObserved: number; 
    
    // V3 Sub-scores
    reactionScore: number;    
    initiativeScore: number;  
    spoofScore: number;
    decayScore: number;

    // R4-2: Iceberg detection
    refillCount: number;
}

export class LiquidityEngine {
    // 1. Isolated Entity Pools: Map<Exchange, Map<EntityId, Entity>>
    private entityPools: Map<string, Map<string, Entity>> = new Map();
    // 2. Trade Buffer for Reaction cross-val (last 10s)
    private tradeBuffer: TradeOrder[] = []; 
    
    private priceHist: Record<string, number> = {};
    // BUG FIX: was a single global timestamp, causing all symbols except the last-updated one to be filtered out
    private lastUpdateMsMap: Map<string, number> = new Map(); // symbol → last depth update ms
    private lastUpdateMs: number = 0; // kept for compatibility (saveSnapshot)
    private lastSnapshotTime: number = 0;
    
    // V4 Pro: Dynamic Flow Tracking
    private prevDepthSnapshots: Map<string, Map<number, number>> = new Map();
    private wciFlows: Record<string, number> = {}; 

    private channel: BroadcastChannel | null = null;
    private DB_NAME = 'TradingMonitorDB';
    private STORE_NAME = 'snapshots';

    constructor() {
        if (typeof window !== 'undefined') {
            this.initDB().then(() => this.loadLatestSnapshot());
            this.channel = new BroadcastChannel('whale-monitor-sync');
            this.channel.onmessage = (ev) => {
                if (ev.data.type === 'snapshot-saved') {
                    this.loadLatestSnapshot();
                }
            };
            
            setInterval(() => this.saveSnapshot(), 60000); // 60s
            setInterval(() => this.cleanTradeBuffer(), 10000); // clear old trades
        }
    }

    private async initDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(this.DB_NAME, 1);
            req.onupgradeneeded = (e: any) => {
                if (!e.target.result.objectStoreNames.contains(this.STORE_NAME)) {
                    e.target.result.createObjectStore(this.STORE_NAME, { keyPath: 'timestamp' });
                }
            };
            req.onsuccess = () => resolve(true);
            req.onerror = (e) => reject(e);
        });
    }

    private async loadLatestSnapshot() {
        const req = indexedDB.open(this.DB_NAME, 1);
        req.onsuccess = (e: any) => {
            const db = e.target.result;
            const tx = db.transaction(this.STORE_NAME, 'readonly');
            const store = tx.objectStore(this.STORE_NAME);
            const cursorReq = store.openCursor(null, 'prev'); // Get latest
            
            cursorReq.onsuccess = (ev: any) => {
                const cursor = ev.target.result;
                if (cursor) {
                    const data = cursor.value.delta as any[];
                    // Rehydrate isolated pools
                    this.entityPools.clear();
                    data.forEach(d => {
                        const entity: Entity = {
                            id: d.id, exchange: d.ex, symbol: d.sym, side: d.s, prices: [d.p], avgPrice: d.p,
                            totalUsd: d.usd, prevUsd: d.usd, firstSeenMs: d.fs, lastSeenMs: d.ls, createdAtMs: d.fs,
                            disappearedCount: d.dc || 0, lifetimeTotalMs: d.lt || 0,
                            minPriceObjObserved: d.p, maxPriceObjObserved: d.p,
                            reactionScore: d.scores.r || 50, initiativeScore: d.scores.i || 50,
                            spoofScore: d.scores.s || 0, decayScore: d.scores.d || 0,
                            // R4-2: restore refill count from snapshot
                            refillCount: icebergDetector.getRefillCount(d.s, d.p, d.sym, d.ex)
                        };
                        this.getPool(d.ex).set(d.id, entity);
                    });
                }
            };
        };
    }

    private getPool(ex: string) {
        if (!this.entityPools.has(ex)) this.entityPools.set(ex, new Map());
        return this.entityPools.get(ex)!;
    }

    private async saveSnapshot() {
        const now = Date.now();
        const activeEntities = this.getAllEntities().filter(e => now - e.lastSeenMs < 10000); // Only actually live
        
        if (activeEntities.length > 0) {
            const compressed = activeEntities.map(e => ({
                id: e.id, ex: e.exchange, sym: e.symbol, s: e.side, p: e.avgPrice, usd: e.totalUsd,
                fs: e.firstSeenMs, ls: e.lastSeenMs, dc: e.disappearedCount, lt: e.lifetimeTotalMs,
                scores: { r: e.reactionScore, i: e.initiativeScore, s: e.spoofScore, d: e.decayScore }
            }));

            const req = indexedDB.open(this.DB_NAME, 1);
            req.onsuccess = (e: any) => {
                const db = e.target.result;
                const tx = db.transaction(this.STORE_NAME, 'readwrite');
                const store = tx.objectStore(this.STORE_NAME);
                store.add({ timestamp: now, delta: compressed });
                
                // Keep only last 24h
                const qReq = store.openCursor();
                qReq.onsuccess = (cev: any) => {
                    const cursor = cev.target.result;
                    if (cursor) {
                        if (now - cursor.value.timestamp > 86400000) cursor.delete();
                        cursor.continue();
                    }
                };

                // Trigger broadcast
                if (this.channel) this.channel.postMessage({ type: 'snapshot-saved' });
            };
            this.lastSnapshotTime = now;
        }
    }

    private getAllEntities() {
        const all: Entity[] = [];
        this.entityPools.forEach(pool => all.push(...Array.from(pool.values())));
        return all;
    }

    public parseTradeUpdate(exchange: string, symbol: string, price: number, usd: number, timestamp: number) {
        this.tradeBuffer.push({ exchange, symbol, price, usd, timestamp });
    }

    private cleanTradeBuffer() {
        const cutoff = Date.now() - 10000;
        this.tradeBuffer = this.tradeBuffer.filter(t => t.timestamp > cutoff);
    }

    parseDepthUpdate(exchange: string, symbol: string, currentPrice: number, bids: [string, string][], asks: [string, string][]) {
        this.priceHist[symbol] = currentPrice;
        const now = Date.now();
        this.lastUpdateMs = now;
        this.lastUpdateMsMap.set(symbol, now); // per-symbol timestamp fix

        const THRESHOLDS: Record<string, number> = {
            BTCUSDT: 3_000_000,
            ETHUSDT: 1_500_000,
            DEFAULT: 500_000
        };
        const minUsdThreshold = THRESHOLDS[symbol.replace('/', '')] || THRESHOLDS.DEFAULT;

        const processRaw = (list: [string, string][], side: 'Buy' | 'Sell') => {
            for (const [pStr, qStr] of list) {
                const price = parseFloat(pStr);
                const usd = price * parseFloat(qStr);
                if (usd < minUsdThreshold) continue;
                this.assignEntity({ exchange, symbol, side, price, usd, timestamp: now }, currentPrice);
            }
        };

        processRaw(bids, 'Buy');
        processRaw(asks, 'Sell');
        
        // --- V4 Pro: WCI Flow Calculation ---
        this.calculateWciFlow(exchange, symbol, bids, asks);

        this.evaluateScores(now, currentPrice, exchange);
    }

    private calculateWciFlow(exchange: string, symbol: string, bids: [string, string][], asks: [string, string][]) {
        const key = `${exchange}_${symbol}`;
        const currentBids = new Map(bids.map(([p, q]) => [parseFloat(p), parseFloat(p) * parseFloat(q)]));
        const currentAsks = new Map(asks.map(([p, q]) => [parseFloat(p), parseFloat(p) * parseFloat(q)]));
        
        const prevBids = this.prevDepthSnapshots.get(`${key}_Buy`) || new Map();
        const prevAsks = this.prevDepthSnapshots.get(`${key}_Sell`) || new Map();

        let addedBuy = 0;
        let cancelledBuy = 0;
        let addedSell = 0;
        let cancelledSell = 0;

        // Bids Delta
        for (const [p, usd] of currentBids) {
            const prevUsd = prevBids.get(p) || 0;
            if (usd > prevUsd) addedBuy += (usd - prevUsd);
        }
        for (const [p, usd] of prevBids) {
            if (!currentBids.has(p)) cancelledBuy += usd;
            else if (currentBids.get(p)! < usd) cancelledBuy += (usd - currentBids.get(p)!);
        }

        // Asks Delta
        for (const [p, usd] of currentAsks) {
            const prevUsd = prevAsks.get(p) || 0;
            if (usd > prevUsd) addedSell += (usd - prevUsd);
        }
        for (const [p, usd] of prevAsks) {
            if (!currentAsks.has(p)) cancelledSell += usd;
            else if (currentAsks.get(p)! < usd) cancelledSell += (usd - currentAsks.get(p)!);
        }

        const flow = (addedBuy - cancelledBuy) - (addedSell - cancelledSell);
        const totalActivity = addedBuy + cancelledBuy + addedSell + cancelledSell;
        
        this.wciFlows[key] = totalActivity > 0 ? flow / totalActivity : 0;

        // Update Snapshots
        this.prevDepthSnapshots.set(`${key}_Buy`, currentBids);
        this.prevDepthSnapshots.set(`${key}_Sell`, currentAsks);
    }

    private assignEntity(raw: RawOrder, currentPrice: number) {
        const pool = this.getPool(raw.exchange);
        let matchedEntity: Entity | null = null;

        for (const entity of pool.values()) {
            if (entity.symbol !== raw.symbol || entity.side !== raw.side) continue;

            const priceDiffPct = Math.abs(entity.avgPrice - raw.price) / raw.price;
            const timeDiff = raw.timestamp - entity.lastSeenMs;

            if (priceDiffPct <= 0.001 && timeDiff <= 2000) {
                matchedEntity = entity;
                break;
            }
        }

        if (matchedEntity) {
            matchedEntity.prevUsd = matchedEntity.totalUsd; 
            matchedEntity.totalUsd = raw.usd; 
            matchedEntity.lastSeenMs = raw.timestamp;
            
            matchedEntity.maxPriceObjObserved = Math.max(matchedEntity.maxPriceObjObserved, currentPrice);
            matchedEntity.minPriceObjObserved = Math.min(matchedEntity.minPriceObjObserved, currentPrice);

            if (!matchedEntity.prices.includes(raw.price)) matchedEntity.prices.push(raw.price);
            matchedEntity.avgPrice = matchedEntity.prices.reduce((a,b)=>a+b,0) / matchedEntity.prices.length;
        } else {
            const newId = `${raw.exchange}_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
            // R4-2: notify iceberg detector that a wall appeared
            const refillCount = icebergDetector.onWallAppear(raw.side, raw.price, raw.usd, raw.symbol, raw.exchange);
            pool.set(newId, {
                id: newId, exchange: raw.exchange, symbol: raw.symbol, side: raw.side,
                prices: [raw.price], avgPrice: raw.price, totalUsd: raw.usd, prevUsd: raw.usd,
                firstSeenMs: raw.timestamp, lastSeenMs: raw.timestamp, createdAtMs: raw.timestamp,
                disappearedCount: 0, lifetimeTotalMs: 0,
                minPriceObjObserved: currentPrice, maxPriceObjObserved: currentPrice,
                reactionScore: 50, initiativeScore: 50, spoofScore: 0, decayScore: 0,
                refillCount
            });
        }
    }

    private evaluateScores(now: number, currentPrice: number, exchange: string) {
        const pool = this.getPool(exchange);
        // CrossMarket evaluation requires inspecting other pools
        const allEntitiesParams = this.getAllEntities();

        for (const [id, entity] of pool.entries()) {
            const ageSec = (now - entity.firstSeenMs) / 1000;
            const distToPx = Math.abs(currentPrice - entity.avgPrice) / currentPrice;
            
            // 1. Decay Score
            if (ageSec > 1800 && distToPx > 0.015) {
                const decayMinutes = (ageSec - 1800) / 60;
                entity.decayScore = Math.min(100, decayMinutes * 2); 
            } else {
                entity.decayScore = 0; 
            }

            // 2. Initiative Score
            if (entity.side === 'Buy') {
                const pushDist = (currentPrice - entity.avgPrice) / entity.avgPrice;
                if (pushDist > 0.01) entity.initiativeScore = Math.min(100, entity.initiativeScore + 10);
            } else {
                const pushDist = (entity.avgPrice - currentPrice) / entity.avgPrice;
                if (pushDist > 0.01) entity.initiativeScore = Math.min(100, entity.initiativeScore + 10);
            }

            // 3. True Reaction Score via aggTrade
            const usdDiff = entity.totalUsd - entity.prevUsd;
            if (distToPx < 0.001) {
                if (usdDiff < 0) {
                    const trades = this.tradeBuffer.filter(t => 
                        t.symbol === entity.symbol && t.exchange === entity.exchange &&
                        Math.abs(t.price - entity.avgPrice) / entity.avgPrice < 0.001 &&
                        t.timestamp > now - 5000 // Trades in last 5s
                    );
                    const tradedUsd = trades.reduce((sum, t) => sum + t.usd, 0);
                    const droppedUsd = Math.abs(usdDiff);

                    const priceNotBreached = entity.side === 'Buy' ? currentPrice >= entity.avgPrice * 0.999 : currentPrice <= entity.avgPrice * 1.001;

                    if (priceNotBreached) {
                        if (tradedUsd >= droppedUsd * 0.8) {
                            // Market hit it, and wall absorbed it
                            entity.reactionScore = Math.min(100, entity.reactionScore + 30);
                            entity.spoofScore = Math.max(0, entity.spoofScore - 20); // legit
                        } else {
                            // Volume dropped, but trades didn't match. They pulled it smoothly! Spoof!
                            entity.spoofScore = Math.min(100, entity.spoofScore + 10);
                        }
                    } else {
                        // Breached!
                        entity.reactionScore = 0;
                    }
                }
            }

            // 4. Persistence
            let persistence = 0;
            if (ageSec > 7200) persistence = 100;
            else if (ageSec > 1800) persistence = 80;
            else if (ageSec > 300) persistence = 40;
            else if (ageSec > 60) persistence = 20;

            // 5. CrossMarket Behavior sync
            let crossMarket = 50;
            const syncedPeers = allEntitiesParams.filter(p => 
                p.exchange !== entity.exchange &&
                p.symbol === entity.symbol && p.side === entity.side &&
                Math.abs(p.avgPrice - entity.avgPrice) / entity.avgPrice < 0.001 &&
                Math.abs(p.firstSeenMs - entity.firstSeenMs) < 2000
            );
            if (syncedPeers.length > 0) crossMarket = 100;

            // 6. Spoof Detection (Historical)
            entity.lifetimeTotalMs += (now - entity.lastSeenMs);
            if (now - entity.lastSeenMs > 5000) {
                // If it missed an update for 5s, it disappeared
                entity.disappearedCount++;
            }
            if (ageSec > 3600) {
                const dropsPerMin = entity.disappearedCount / (ageSec / 60);
                if (dropsPerMin > 2) {
                    entity.spoofScore = 100;
                }
            }

            // Clean disappeared (V4: Stale 30s)
            if (now - entity.lastSeenMs > 30000) {
                // R4-2: notify iceberg detector that this wall disappeared
                icebergDetector.onWallDisappear(entity.side, entity.avgPrice, entity.totalUsd, entity.symbol, entity.exchange);
                // Update entity's refill count before deletion for zone rendering
                entity.refillCount = icebergDetector.getRefillCount(entity.side, entity.avgPrice, entity.symbol, entity.exchange);
                pool.delete(id);
            }
        }
    }

    public getActiveZones(symbol: string, currentPrice: number): ZoneData[] {
        const zones: ZoneData[] = [];
        const now = Date.now();
        // BUG FIX: use per-symbol last-update time so multi-symbol monitoring works correctly
        const symLastUpdate = this.lastUpdateMsMap.get(symbol) ?? now;
        const allLive = this.getAllEntities().filter(e => e.symbol === symbol && (symLastUpdate - e.lastSeenMs < 15000));

        // R4-3-A: Only count walls updated within the last 30s for liquidity calculations
        const FRESH_WALL_MAX_AGE = 30_000;
        const freshLive = allLive.filter(e => now - e.lastSeenMs <= FRESH_WALL_MAX_AGE && e.spoofScore < 40);
        
        // Relative Void Logic using freshLive to avoid stale data inflating liquidity
        const range = currentPrice * 0.01;
        const nearLiq = freshLive.filter(e => Math.abs(e.avgPrice - currentPrice) < range).reduce((s,e) => s + e.totalUsd, 0);
        const farLiq = freshLive.filter(e => {
            const d = Math.abs(e.avgPrice - currentPrice);
            return d >= range && d < range * 3;
        }).reduce((s,e) => s + e.totalUsd, 0);

        if (farLiq > nearLiq * 5 && nearLiq < 10000000) {
            zones.push({
                top: currentPrice + range,
                bottom: currentPrice - range,
                heat: 100,
                type: 'Void',
                side: 'Buy' 
            });
        }

        // Processing Walls
        let buyEntities = allLive.filter(e => e.side === 'Buy').sort((a,b) => b.totalUsd - a.totalUsd);
        let sellEntities = allLive.filter(e => e.side === 'Sell').sort((a,b) => b.totalUsd - a.totalUsd);

        for (const e of [...buyEntities, ...sellEntities]) {
            const ageMs = this.lastUpdateMs - e.firstSeenMs;
            const persistenceState = ageMs >= 180000 ? 'CONFIRMED' : 'PENDING';
            
            // Only show confirmed or very high volume pending
            if (persistenceState === 'PENDING' && e.totalUsd < 5000000) continue;

            const ageSec = ageMs / 1000;
            let persistence = ageSec > 7200 ? 100 : (ageSec > 1800 ? 80 : (ageSec > 300 ? 40 : 20));

            const distToPx = Math.abs(currentPrice - e.avgPrice) / currentPrice;
            let distance = distToPx < 0.002 ? 0 : (distToPx < 0.005 ? 20 : (distToPx < 0.02 ? 80 : 100));

            let rawTrust = (e.reactionScore * 0.15) + (e.initiativeScore * 0.15) + 
                          (50 * 0.15) + (50 * 0.15) + 
                          (persistence * 0.1) + (distance * 0.1) + (50 * 0.1) + 
                          (50 * 0.1) - (e.decayScore * 0.1);

            // R1-L6: Spoof Score Truncation
            let Trust = rawTrust;
            let isTrap = false;
            if (e.spoofScore > 60) {
                Trust = 0;
                isTrap = true;
            } else {
                const cap = e.spoofScore >= 40 ? 40 : 100;
                Trust = Math.min(cap, Math.max(0, rawTrust));
                isTrap = Trust < 30;
            }

            const heat = Math.min(100, Math.round((Trust * 0.6) + 40));

            // V4 Confidence — R4-7-B: skip cross-exchange matching if latency is anomalous
            const matchWindow = latencyMonitor.getMatchWindow();
            const matches = matchWindow > 0 ? allLive.filter(o =>
                o.id !== e.id && o.side === e.side &&
                o.exchange !== e.exchange &&
                Math.abs(o.avgPrice - e.avgPrice) / e.avgPrice <= 0.0005
            ) : [];
            const exchanges = new Set(matches.map(o => o.exchange));
            exchanges.add(e.exchange);
            const confidence = exchanges.size >= 3 ? 'HIGH' : (exchanges.size === 2 ? 'MED' : 'LOW');

            // R4-2: Iceberg label boost — confirmed iceberg raises trust
            const isIceberg = e.refillCount >= 3;
            const icebergTrustBonus = isIceberg ? Math.min(20, e.refillCount * 5) : 0;
            const finalTrust = Math.min(100, Trust + icebergTrustBonus);
            const finalHeat  = Math.min(100, Math.round((finalTrust * 0.6) + 40));

            zones.push({
                top: Math.max(...e.prices),
                bottom: Math.min(...e.prices),
                heat: isTrap ? Math.min(100, e.spoofScore * 1.5) : finalHeat,
                type: isTrap ? 'Trap' : 'Wall',
                side: e.side,
                spoofScore: e.spoofScore,
                reactionScore: e.reactionScore,
                firstSeenMs: e.firstSeenMs,
                totalUsd: e.totalUsd,
                confidence,
                persistenceState
            });
        }

        return zones.sort((a,b) => b.heat - a.heat);
    }

    /**
     * WCI = (Total Buy Usd - Total Sell Usd) / Total Usd
     * Range: -1 (Strong Sell Control) to +1 (Strong Buy Control)
     */
    public getWhaleControlIndex(exchange: string, symbol: string): number {
        const pool = this.entityPools.get(exchange);
        if (!pool) return 0;

        // R1-L7: WCI filters out spoofed walls
        const all = Array.from(pool.values()).filter(e => e.symbol === symbol && e.spoofScore < 40);
        const totalBuy = all.filter(e => e.side === 'Buy').reduce((s, e: Entity) => s + e.totalUsd, 0);
        const totalSell = all.filter(e => e.side === 'Sell').reduce((s, e: Entity) => s + e.totalUsd, 0);
        const total = totalBuy + totalSell;

        if (total === 0) return 0;
        return (totalBuy - totalSell) / total;
    }

    public getWhaleControlFlow(exchange: string, symbol: string): number {
        return this.wciFlows[`${exchange}_${symbol}`] || 0;
    }
}
