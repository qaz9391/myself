/**
 * R5 Engine — Round 5 Architecture Upgrades
 * "讓訊號可信，而不是看起來合理"
 *
 * Modules:
 *  R5-1: EventTimeNormalizer  — stream time alignment via median offset
 *  R5-2: PauseModel           — confidence-weighted, regime-stratified
 *  R5-3: RegimeEngine         — market state classification
 *  R5-4: EventClassifier      — wall disappearance semantics (consumed / cancelled / partial)
 *  R5-5: RegimeAwareGapRisk   — context-aware gap risk
 *  R5-6: LRU WallStore        — memory-safe snapshot store
 */

// ─────────────────────────────────────────────────────────────
// R5-3: Market Regime
// ─────────────────────────────────────────────────────────────
export type Regime = 'trend_up' | 'trend_down' | 'range' | 'high_volatility';

export class RegimeEngine {
    /**
     * Classifies market state from price / EMA / ATR data.
     * Prioritises volatility first (flash-crash safety), then trend.
     */
    getRegime(params: {
        price: number;
        ema21: number;
        ema200: number;
        atr14: number;  // Median ATR from AnchorEngine
    }): Regime {
        const { price, ema21, ema200, atr14 } = params;

        // > 2% ATR/price = high volatility regime (flash-crash / news spike)
        if (atr14 / price > 0.02) return 'high_volatility';

        if (price > ema200 && ema21 > ema200) return 'trend_up';
        if (price < ema200 && ema21 < ema200) return 'trend_down';

        return 'range';
    }

    /** Returns a human-readable label with emoji for UI display */
    label(regime: Regime): string {
        switch (regime) {
            case 'trend_up':        return '📈 趨勢上行';
            case 'trend_down':      return '📉 趨勢下行';
            case 'high_volatility': return '⚡ 高波動';
            case 'range':           return '🔲 箱型整理';
        }
    }
}

// ─────────────────────────────────────────────────────────────
// R5-1: Event Time Normalizer
// ─────────────────────────────────────────────────────────────
export type StreamType = 'book' | 'trade' | 'liquidation';

/**
 * Calibrates inter-stream time offset using matched (book_change, trade) pairs.
 * Uses median to stay robust against network jitter outliers.
 */
class OffsetCalibrator {
    private samples: { bookTs: number; tradeTs: number }[] = [];
    private readonly MAX_SAMPLES = 200;

    recordMatch(bookTs: number, tradeTs: number): void {
        this.samples.push({ bookTs, tradeTs });
        if (this.samples.length > this.MAX_SAMPLES) this.samples.shift();
    }

    /** Median of (tradeTs - bookTs) differences */
    computeOffset(): number {
        if (this.samples.length < 5) return 0;
        const diffs = this.samples.map(s => s.tradeTs - s.bookTs).sort((a, b) => a - b);
        return diffs[Math.floor(diffs.length / 2)];
    }
}

export class EventTimeNormalizer {
    private offsets: Record<StreamType, number> = {
        book: 0,
        trade: 0,
        liquidation: 0,
    };
    private calibrators: Record<string, OffsetCalibrator> = {};

    /**
     * Returns a corrected timestamp for any stream event.
     * The offset is derived from live (book, trade) pair matching.
     */
    normalize(ts: number, stream: StreamType): number {
        return ts + this.offsets[stream];
    }

    /**
     * Call this when a book_change and a nearby trade can be matched
     * (same price ±0.1%, within ±5 seconds).
     * Over time this auto-calibrates the book→trade offset.
     */
    recordMatch(exchange: string, bookTs: number, tradeTs: number): void {
        if (!this.calibrators[exchange]) {
            this.calibrators[exchange] = new OffsetCalibrator();
        }
        this.calibrators[exchange].recordMatch(bookTs, tradeTs);
        const offset = this.calibrators[exchange].computeOffset();
        // book events tend to lag trades; apply negative offset to book timestamps
        this.offsets.book = -offset;
    }

    /** Returns current offsets for debugging / display */
    getOffsets(): Record<StreamType, number> {
        return { ...this.offsets };
    }
}

// ─────────────────────────────────────────────────────────────
// R5-4: Event Classifier
// ─────────────────────────────────────────────────────────────
export type EventType = 'consumed' | 'cancelled' | 'partial' | 'unknown';

export interface ClassifiedEvent {
    type: EventType;
    /** 0-1: how confident we are about the classification */
    confidence: number;
    /** Fraction of wall quantity explained by nearby trades */
    consumeRatio: number;
}

/**
 * Classifies why a wall disappeared using matched trade volume.
 * R5-4: introduces 'partial' classification (previously unhandled).
 */
export function classifyWallDisappear(
    wallQty: number,
    consumedVolume: number,  // sum of trades within ±0.1% price / ±5s window
): ClassifiedEvent {
    const ratio = wallQty > 0 ? consumedVolume / wallQty : 0;

    if (ratio > 0.8) {
        return { type: 'consumed', confidence: 0.9, consumeRatio: ratio };
    }
    if (ratio < 0.2) {
        return { type: 'cancelled', confidence: 0.8, consumeRatio: ratio };
    }
    // 0.2 – 0.8: partial fill (iceberg partial absorb, or split order)
    return { type: 'partial', confidence: 0.5, consumeRatio: ratio };
}

// ─────────────────────────────────────────────────────────────
// R5-2: Confidence-weighted, Regime-stratified PauseModel
// ─────────────────────────────────────────────────────────────
export interface PauseRecord {
    wallSizeUSD:     number;
    duration:        number;  // ms the wall was alive
    crossExCount:    number;
    didPause:        boolean;
    confidenceScore: number;  // 0-1 from ClassifiedEvent
    regime:          Regime;
    timestamp:       number;
}

const MIN_SAMPLES = 30;

export class PauseModel {
    private history: PauseRecord[] = [];
    private readonly MAX_HISTORY = 10_000;

    record(rec: PauseRecord): void {
        // Only record consumed / partial events (not cancelled — those are spoof, R4-1-A)
        if (rec.confidenceScore <= 0) return;
        this.history.push(rec);
        if (this.history.length > this.MAX_HISTORY) this.history.shift();
    }

    /**
     * Returns weighted pause probability for a wall in a given regime.
     * Confidence scores weight each sample — low-confidence data has less influence.
     */
    predict(wallSizeUSD: number, regime: Regime): {
        probability: number;
        sampleCount: number;
        isReliable: boolean;
    } {
        const relevant = this.history.filter(r =>
            // Same regime
            r.regime === regime &&
            // Within 50% of size (relative filter)
            Math.abs(r.wallSizeUSD - wallSizeUSD) / (wallSizeUSD || 1) < 0.5
        );

        if (relevant.length < MIN_SAMPLES) {
            return { probability: 0.5, sampleCount: relevant.length, isReliable: false };
        }

        let weightedPause = 0;
        let totalWeight   = 0;

        for (const r of relevant) {
            const weight = r.confidenceScore;
            totalWeight  += weight;
            if (r.didPause) weightedPause += weight;
        }

        const probability = totalWeight > 0 ? weightedPause / totalWeight : 0.5;
        return {
            probability: parseFloat(probability.toFixed(3)),
            sampleCount: relevant.length,
            isReliable: true,
        };
    }

    get recordCount(): number { return this.history.length; }
}

// ─────────────────────────────────────────────────────────────
// R5-5: Regime-aware Gap Risk
// ─────────────────────────────────────────────────────────────
export type GapRiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export function calcRegimeAwareGapRisk(
    gapInATR: number,
    gapLiquidityUSD: number,
    regime: Regime,
): GapRiskLevel {
    // High-volatility: fast-moving market, even moderate gaps become dangerous
    if (regime === 'high_volatility') {
        if (gapInATR > 2.0) return 'CRITICAL';
        if (gapInATR > 1.0) return 'HIGH';
        return 'MEDIUM';
    }

    // Range-bound: mean-reversion tendency, need larger gap to be risky
    if (regime === 'range') {
        if (gapInATR > 4.0 && gapLiquidityUSD < 5_000_000)  return 'HIGH';
        if (gapInATR > 6.0) return 'CRITICAL';
        return 'LOW';
    }

    // Trending (up or down): momentum can drive through gaps quickly
    if (regime === 'trend_up' || regime === 'trend_down') {
        if (gapInATR > 3.0 && gapLiquidityUSD < 10_000_000) return 'CRITICAL';
        if (gapInATR > 2.0) return 'HIGH';
        if (gapInATR > 1.0) return 'MEDIUM';
        return 'LOW';
    }

    return 'LOW';
}

// ─────────────────────────────────────────────────────────────
// R5-6: Memory-safe LRU WallStore
// ─────────────────────────────────────────────────────────────
export interface WallSnapshot {
    key:           string;
    price:         number;
    side:          'Buy' | 'Sell';
    exchange:      string;
    symbol:        string;
    lockedSizeUSD: number;
    trust:         number;
    spoofScore:    number;
    firstSeen:     number;
    refillCount:   number;
}

/** LRU map with max-size eviction. Map preserves insertion order — oldest first. */
export class WallStore {
    private store = new Map<string, WallSnapshot>();
    private readonly MAX_SIZE: number;

    constructor(maxSize = 10_000) {
        this.MAX_SIZE = maxSize;
    }

    set(key: string, value: WallSnapshot): void {
        // Refresh position (delete + re-insert = move to newest)
        if (this.store.has(key)) this.store.delete(key);

        this.store.set(key, value);

        // Evict oldest entry when over capacity
        if (this.store.size > this.MAX_SIZE) {
            const oldest = this.store.keys().next().value;
            if (oldest) this.store.delete(oldest);
        }
    }

    get(key: string): WallSnapshot | undefined {
        return this.store.get(key);
    }

    delete(key: string): void {
        this.store.delete(key);
    }

    get size(): number { return this.store.size; }
    values(): IterableIterator<WallSnapshot> { return this.store.values(); }
}

// ─────────────────────────────────────────────────────────────
// R5 Facade — wire everything together for the UI
// ─────────────────────────────────────────────────────────────
export interface WallSignal {
    wallSizeUSD:   number;
    regime:        Regime;
    pauseProb:     number;   // 0–1
    confidence:    number;   // 0–1
    isReliable:    boolean;
    regimeLabel:   string;
    /** Human-readable signal quality hint */
    verdict:       string;
}

export class R5Engine {
    readonly timeNormalizer = new EventTimeNormalizer();
    readonly regimeEngine   = new RegimeEngine();
    readonly pauseModel     = new PauseModel();
    readonly wallStore      = new WallStore();

    private regimes = new Map<string, Regime>();

    /** Call every time you have fresh EMA + ATR data for a symbol */
    updateRegime(symbol: string, price: number, ema21: number, ema200: number, atr14: number): void {
        this.regimes.set(symbol, this.regimeEngine.getRegime({ price, ema21, ema200, atr14 }));
    }

    getRegime(symbol: string): Regime {
        return this.regimes.get(symbol) ?? 'range';
    }

    getRegimeLabel(symbol: string): string {
        return this.regimeEngine.label(this.getRegime(symbol));
    }

    /** Helper to compute EMA */
    static calcEMA(closes: number[], period: number): number {
        if (closes.length < period) return closes[closes.length - 1] || 0;
        let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
        const k = 2 / (period + 1);
        for (let i = period; i < closes.length; i++) {
            ema = closes[i] * k + ema * (1 - k);
        }
        return ema;
    }

    /** Helper to compute ATR */
    static calcATR(highs: number[], lows: number[], closes: number[], period: number): number {
        if (highs.length < period + 1) return 0;
        const trs = [];
        for (let i = 1; i < highs.length; i++) {
            const hl = highs[i] - lows[i];
            const hc = Math.abs(highs[i] - closes[i - 1]);
            const lc = Math.abs(lows[i] - closes[i - 1]);
            trs.push(Math.max(hl, hc, lc));
        }
        // Simple moving average of TR
        const recentTrs = trs.slice(-period);
        return recentTrs.reduce((a, b) => a + b, 0) / period;
    }

    /**
     * Main signal generation for a wall.
     */
    evaluateWall(symbol: string, wallSizeUSD: number): WallSignal {
        const regime = this.getRegime(symbol);
        const result = this.pauseModel.predict(wallSizeUSD, regime);
        const { probability, sampleCount, isReliable } = result;

        let verdict: string;
        if (!isReliable) {
            verdict = `⚪ 樣本不足 (${sampleCount}/${30})，謹慎參考`;
        } else if (probability >= 0.70) {
            verdict = `🟢 高概率停頓 ${(probability * 100).toFixed(0)}%`;
        } else if (probability >= 0.50) {
            verdict = `🟡 停頓概率中等 ${(probability * 100).toFixed(0)}%`;
        } else {
            verdict = `🔴 可能被穿透 ${((1 - probability) * 100).toFixed(0)}%`;
        }

        return {
            wallSizeUSD,
            regime,
            pauseProb:   probability,
            confidence:  isReliable ? 1 : sampleCount / 30,
            isReliable,
            regimeLabel: this.regimeEngine.label(regime),
            verdict,
        };
    }

    /** Wire a wall disappear event into the PauseModel */
    recordWallOutcome(params: {
        symbol:          string;
        wallSizeUSD:     number;
        durationMs:      number;
        crossExCount:    number;
        didPause:        boolean;
        consumedVolume:  number;
        wallQty:         number;
    }): void {
        const event = classifyWallDisappear(params.wallQty, params.consumedVolume);
        if (event.type === 'cancelled') return;

        this.pauseModel.record({
            wallSizeUSD:     params.wallSizeUSD,
            duration:        params.durationMs,
            crossExCount:    params.crossExCount,
            didPause:        params.didPause,
            confidenceScore: event.confidence,
            regime:          this.getRegime(params.symbol),
            timestamp:       Date.now(),
        });
    }
}

/** Singleton: one R5Engine per browser tab */
export const r5Engine = new R5Engine();
