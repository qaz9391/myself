export class DirectionalEngine {
    /**
     * 計算突破機率分數與方向性 (-100 ~ +100)
     * v3.0: Added Consensus Layer & Whale Control Index (WCI)
     */
    static calculateBias(params: {
        pattern: { type: string, direction: string },
        emaTrend: string, // "bullish" | "bearish" | "neutral"
        nearestSupport: number | null,
        nearestResistance: number | null,
        currentPrice: number,
        whaleControlIndex: number, // -1 ~ +1
        whaleControlFlow: number, // -1 ~ +1 (V4 Pro)
        mtfTrends?: { m15: string, h1: string, h4: string } // V4 Pro
    }) {
        let score = 0;
        const signals: number[] = []; // +1 for bullish, -1 for bearish, 0 for neutral

        // 1. 型態偏向 (30%)
        let patternScore = 0;
        if (params.pattern.type === "ascending_triangle") patternScore = 30;
        else if (params.pattern.type === "descending_triangle") patternScore = -30;
        score += patternScore;
        signals.push(Math.sign(patternScore));
        
        // 2. EMA 趨勢 (20%)
        let emaScore = 0;
        if (params.emaTrend === "bullish") emaScore = 20;
        else if (params.emaTrend === "bearish") emaScore = -20;
        score += emaScore;
        signals.push(Math.sign(emaScore));

        // 3. 大戶主導權 WCI (20%)
        // WCI > 0.6 strong buy, WCI < -0.6 strong sell
        let whaleScore = 0;
        if (params.whaleControlIndex > 0.3) whaleScore = 20 * params.whaleControlIndex;
        else if (params.whaleControlIndex < -0.3) whaleScore = 20 * params.whaleControlIndex;
        score += whaleScore;
        signals.push(Math.sign(whaleScore));

        // 4. Anchor 距離 (30%)
        let anchorScore = 0;
        if (params.nearestSupport && params.nearestResistance) {
            const distSup = (params.currentPrice - params.nearestSupport) / params.nearestSupport;
            const distRes = (params.nearestResistance - params.currentPrice) / params.currentPrice;
            
            if (distSup < 0.02) anchorScore = 30;
            else if (distSup <= 0.05) anchorScore = 15;
            
            if (distRes < 0.02) anchorScore = -30;
            else if (distRes <= 0.05) anchorScore = -15;
        }
        score += anchorScore;
        signals.push(Math.sign(anchorScore));

        // 5. MTF 共振 (V4 Pro) - 20% 加成
        if (params.mtfTrends) {
            const trends = [params.mtfTrends.m15, params.mtfTrends.h1, params.mtfTrends.h4];
            const bullCount = trends.filter(t => t === 'bullish').length;
            const bearCount = trends.filter(t => t === 'bearish').length;
            if (bullCount >= 2) score += 20;
            if (bearCount >= 2) score -= 20;
        }

        // 6. WCI Flow 修正 (V4 Pro)
        if (params.whaleControlFlow > 0.5) score += 15;
        if (params.whaleControlFlow < -0.5) score -= 15;

        // R2-K: Consensus Layer Validation
        const bullishCount = signals.filter(s => s > 0).length;
        const bearishCount = signals.filter(s => s < 0).length;
        let agreementCount = Math.max(bullishCount, bearishCount);
        let agreementScore = (agreementCount / 4) * 100;
        
        const totalStrength = Math.abs(patternScore) + Math.abs(emaScore) + Math.abs(whaleScore) + Math.abs(anchorScore);
        let agreementLabel = "低 (信號衝突)";

        if (totalStrength < 30) {
            agreementLabel = "無明確方向，觀望";
            agreementScore = 0;
            agreementCount = 0;
        } else {
            if (agreementScore >= 75) agreementLabel = "高 (強效共振) 🔥";
            else if (agreementScore >= 50 && (bullishCount === 0 || bearishCount === 0)) agreementLabel = "中 (多數一致) 🟡";
            else agreementLabel = "低 (信號衝突)";
        }

        // Final Score clipping
        score = Math.max(-100, Math.min(100, score));
        const upProb = 50 + (score / 2);

        let whaleAction = "🐋 無主導";
        if (params.whaleControlIndex > 0.6) whaleAction = "🐋 大戶強勢托盤";
        else if (params.whaleControlIndex > 0.2) whaleAction = "🐋 核心吸籌中";
        else if (params.whaleControlIndex < -0.6) whaleAction = "🐋 大戶強勢壓制";
        else if (params.whaleControlIndex < -0.2) whaleAction = "🐋 上方拋售中";
        
        if (params.whaleControlFlow > 0.6) whaleAction = "🐋 積極掃貨中 🔥";
        if (params.whaleControlFlow < -0.6) whaleAction = "🐋 積極派發中 📉";

        // --- V4 Pro: RR Engine & Trade Setup ---
        const isBullish = score >= 0;
        const entry = params.currentPrice;
        let target = isBullish ? (params.nearestResistance || entry * 1.05) : (params.nearestSupport || entry * 0.95);
        let stopLoss = isBullish ? (params.nearestSupport || entry * 0.98) : (params.nearestResistance || entry * 1.02);

        // Ensure SL is on the correct side
        if (isBullish && stopLoss >= entry) stopLoss = entry * 0.99;
        if (!isBullish && stopLoss <= entry) stopLoss = entry * 1.01;

        const risk = Math.abs(entry - stopLoss);
        const reward = Math.abs(target - entry);
        const rr = reward / (risk || 0.0001);

        // No Trade Zone Filter
        let tradeStatus = "可交易";
        if (agreementScore < 50) tradeStatus = "⚠️ 無交易優勢 (信號衝突)";
        else if (rr < 1.5) tradeStatus = "⚠️ 無交易優勢 (盈虧比過低)";
        else if (Math.abs(params.whaleControlIndex) < 0.2) tradeStatus = "⚠️ 無交易優勢 (大戶觀望)";

        return {
            score,
            upProb: Math.round(upProb),
            downProb: Math.round(100 - upProb),
            direction: isBullish ? '▲' : '▼',
            whaleAction,
            agreementScore,
            agreementLabel,
            tradeStatus,
            setup: {
                entry: parseFloat(entry.toFixed(4)),
                target: parseFloat(target.toFixed(4)),
                stopLoss: parseFloat(stopLoss.toFixed(4)),
                rr: parseFloat(rr.toFixed(2))
            },
            params // V4 Pro: Return params for real-time updates
        };
    }
}

// R4-4-B: Cumulative Delta Engine with Squeeze-aware reanchor
// Tracks net buy vs sell pressure since a given anchor point.
type ReanchorTrigger = 'manual' | 'squeeze' | 'session';

interface DeltaBucket {
    ts: number;
    buyUsd: number;
    sellUsd: number;
}

export class CumulativeDeltaEngine {
    private buckets = new Map<number, DeltaBucket>();
    private anchorTimestamp = 0;
    private lastReanchorTime = 0;

    private readonly BUCKET_MS           =     60_000; // 1-minute buckets
    private readonly MIN_REANCHOR_MS     = 4 * 3600_000; // normal: 4 hours
    private readonly SQUEEZE_REANCHOR_MS =     3600_000;  // R4-4-B: squeeze trigger: 1 hour
    private readonly MAX_BUCKETS         = 1440;           // 24h of 1-min buckets

    constructor() {
        this.anchorTimestamp = Date.now();
    }

    addTrade(price: number, qty: number, isBuyerMaker: boolean, timestamp: number): void {
        const bucketTs = Math.floor(timestamp / this.BUCKET_MS) * this.BUCKET_MS;
        if (!this.buckets.has(bucketTs)) {
            this.buckets.set(bucketTs, { ts: bucketTs, buyUsd: 0, sellUsd: 0 });
            if (this.buckets.size > this.MAX_BUCKETS) {
                const oldest = Math.min(...this.buckets.keys());
                this.buckets.delete(oldest);
            }
        }
        const usd = price * qty;
        const bucket = this.buckets.get(bucketTs)!;
        if (isBuyerMaker) bucket.sellUsd += usd;
        else              bucket.buyUsd  += usd;
    }

    /**
     * R4-4-B: Reanchor the delta window.
     * 'squeeze' trigger uses 1-hour cooldown so breakout signal isn't diluted.
     * 'session' trigger has no cooldown.
     * 'manual' trigger uses the normal 4-hour cooldown.
     */
    reanchor(trigger: ReanchorTrigger = 'manual', anchorTs?: number): boolean {
        const now = Date.now();
        const cooldown = trigger === 'squeeze' ? this.SQUEEZE_REANCHOR_MS
                       : trigger === 'session' ? 0
                       : this.MIN_REANCHOR_MS;

        if (now - this.lastReanchorTime < cooldown) return false;
        this.anchorTimestamp  = anchorTs ?? now;
        this.lastReanchorTime = now;
        return true;
    }

    getDelta(): { buyUsd: number; sellUsd: number; netDelta: number; normalized: number } {
        let buyUsd = 0;
        let sellUsd = 0;
        for (const [ts, b] of this.buckets) {
            if (ts < this.anchorTimestamp) continue;
            buyUsd  += b.buyUsd;
            sellUsd += b.sellUsd;
        }
        const total      = buyUsd + sellUsd;
        const netDelta   = buyUsd - sellUsd;
        const normalized = total > 0 ? netDelta / total : 0; // -1 to +1
        return { buyUsd, sellUsd, netDelta, normalized };
    }

    get anchoredAt(): number { return this.anchorTimestamp; }
}
