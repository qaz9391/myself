export interface KLine {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface Zone {
    top: number;
    bottom: number;
    poc: number; // Point of Control (Highest Vol Price)
    score: number;
    densityScore: number; // (Touches * Vol) / Width
    defendRate: number;
    touchCount: number;
    volumeStrength: number;
    timeframes: string[];
    defendReactionScore: number;
    // V4 Proximity & Rank
    distFromPricePct?: number;
    isExtremelyNear?: boolean; // < 0.5%
    rank?: 'S' | 'A' | 'B' | 'C';
}

// R4-3: Anchor Gap Analysis
export type GapRiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export interface AnchorGap {
    upperZone: Zone;
    lowerZone: Zone;
    gapPct: number;
    gapInATR: number;
    gapLiquidity: number;  // USD value of fresh walls within gap
    freshnessRatio: number; // ratio of fresh walls vs all walls
    riskLevel: GapRiskLevel;
    targetIfBreached: number; // lower zone poc
}

interface PriceMemory {
    price: number;
    touchCount: number;
    defendCount: number;
    breakCount: number;
    totalVolume: number;
    lastTouch: number;
    touchCount30d: number;
    timeframeHits: Set<string>;
}

export class AnchorEngine {
    private calculateDynamicTickSize(currentPrice: number): number {
        // BTC 60k -> 10, ETH 3k -> 0.1, SOL 150 -> 0.01, DOGE 0.15 -> 0.00001
        if (currentPrice > 10000) return 10;
        if (currentPrice > 1000) return 1;
        if (currentPrice > 100) return 0.1;
        if (currentPrice > 1) return 0.01;
        if (currentPrice > 0.1) return 0.001;
        return 0.0001;
    }

    private calculateATR(klines: KLine[], period: number = 14): number[] {
        const medianAtr: number[] = [];
        const trueRanges: number[] = [];
        for (let i = 0; i < klines.length; i++) {
            let tr = klines[i].high - klines[i].low;
            if (i > 0) {
                const tr1 = Math.abs(klines[i].high - klines[i - 1].close);
                const tr2 = Math.abs(klines[i].low - klines[i - 1].close);
                tr = Math.max(tr, tr1, tr2);
            }
            trueRanges.push(tr);
            if (i < period) {
                const recent = trueRanges.slice(0, i + 1);
                const sorted = [...recent].sort((a, b) => a - b);
                medianAtr.push(sorted[Math.floor(sorted.length / 2)]);
            } else {
                const recent = trueRanges.slice(i - period + 1, i + 1);
                const sorted = [...recent].sort((a, b) => a - b);
                medianAtr.push(sorted[Math.floor(sorted.length / 2)]);
            }
        }
        return medianAtr;
    }

    private calculateEMA(klines: KLine[], period: number = 200): number[] {
        const ema: number[] = [];
        const k = 2 / (period + 1);
        let currentEma = klines[0].close;
        for (let i = 0; i < klines.length; i++) {
            currentEma = (klines[i].close - currentEma) * k + currentEma;
            ema.push(currentEma);
        }
        return ema;
    }

    public processTimeframes(timeframeData: Record<string, KLine[]>, currentPrice: number): Zone[] {
        const tickSize = this.calculateDynamicTickSize(currentPrice);
        const memoryMap = new Map<number, PriceMemory>();
        let overallVolumeSum = 0;
        let overallVolumeCount = 0;

        for (const [tf, klines] of Object.entries(timeframeData)) {
            if (!klines || klines.length < 50) continue;

            const atr = this.calculateATR(klines);
            const ema200 = this.calculateEMA(klines, 200);

            for (let i = 200; i < klines.length; i++) {
                const k = klines[i];
                const currentAtr = atr[i];
                const currentEma = ema200[i];

                // Layer 1: Extreme wick filtering (> 3x ATR)
                const bodyTop = Math.max(k.open, k.close);
                const bodyBot = Math.min(k.open, k.close);
                const upperWick = k.high - bodyTop;
                const lowerWick = bodyBot - k.low;
                
                let scanHigh = k.high;
                let scanLow = k.low;

                // R2-G: Dynamic Wick Filter Multiplier
                const atrHistory90d = atr.slice(Math.max(0, i - 540), i + 1);
                const sortedAtr = [...atrHistory90d].sort((a, b) => a - b);
                const rank = sortedAtr.filter(a => a <= currentAtr).length;
                const pct = rank / (sortedAtr.length || 1);
                let multiplier = 2.0;
                if (pct >= 0.80) multiplier = 4.0;
                else if (pct >= 0.50) multiplier = 3.0;
                else if (pct >= 0.20) multiplier = 2.5;

                if (upperWick > currentAtr * multiplier) scanHigh = bodyTop + currentAtr * multiplier;
                if (lowerWick > currentAtr * multiplier) scanLow = bodyBot - currentAtr * multiplier;

                // Price Binning bounds
                const minBin = Math.floor(scanLow / tickSize) * tickSize;
                const maxBin = Math.ceil(scanHigh / tickSize) * tickSize;

                overallVolumeSum += k.volume;
                overallVolumeCount++;

                for (let p = minBin; p <= maxBin; p += tickSize) {
                    const pricePoint = parseFloat(p.toFixed(5));

                    if (!memoryMap.has(pricePoint)) {
                        memoryMap.set(pricePoint, {
                            price: pricePoint, touchCount: 0, touchCount30d: 0, defendCount: 0, breakCount: 0,
                            totalVolume: 0, lastTouch: 0, timeframeHits: new Set()
                        });
                    }

                    const mem = memoryMap.get(pricePoint)!;
                    mem.touchCount += 1;
                    if (Date.now() - k.time <= 30 * 86400000) {
                        mem.touchCount30d += 1;
                    }
                    mem.totalVolume += (k.volume / ((maxBin - minBin) / tickSize || 1));
                    mem.lastTouch = k.time;
                    mem.timeframeHits.add(tf);

                    // Layer 3: Defend/Break Detection (Lookahead N=5到10)
                    const lookaheadEnd = Math.min(i + 10, klines.length - 1);
                    const isAbove = k.close > pricePoint;
                    let bounced = false;
                    let broken = false;
                    let breakConfirmCount = 0;

                    for (let j = i + 1; j <= lookaheadEnd; j++) {
                        const fk = klines[j];
                        const triggerDist = currentAtr * 0.5;
                        const MIN_BREACH_PCT = 0.003; // R1-L2 Optimization

                        if (isAbove) {
                            // Price came from above, hitting target as support
                            if (fk.high > pricePoint + triggerDist) bounced = true;
                            const breachPct = (pricePoint - fk.close) / pricePoint;
                            if (breachPct >= MIN_BREACH_PCT && fk.close < pricePoint) breakConfirmCount++;
                        } else {
                            // Price came from below, hitting target as resistance
                            if (fk.low < pricePoint - triggerDist) bounced = true;
                            const breachPct = (fk.close - pricePoint) / pricePoint;
                            if (breachPct >= MIN_BREACH_PCT && fk.close > pricePoint) breakConfirmCount++;
                        }

                        if (breakConfirmCount >= 2) broken = true;

                        if (bounced || broken) break; // Decided
                    }

                    if (bounced && !broken) {
                        mem.defendCount += 1;
                    } else if (broken) {
                        mem.breakCount += 1;
                    }
                }
            }
        }

        const avgVolumePerBin = overallVolumeSum / (overallVolumeCount || 1);

        // Layer 4: Clustering
        const rawPoints = Array.from(memoryMap.values()).sort((a,b) => a.price - b.price);
        const zones: Zone[] = [];
        let currentZone: PriceMemory[] = [];

        const mergeThresholdPct = 0.005; // 0.5% cluster threshold

        for (const pt of rawPoints) {
            // Drop un-tested memories
            if (pt.touchCount < 2) continue;

            if (currentZone.length === 0) {
                currentZone.push(pt);
            } else {
                const zoneAvg = currentZone.reduce((s,x)=>s+x.price, 0)/currentZone.length;
                if (Math.abs(pt.price - zoneAvg) / zoneAvg <= mergeThresholdPct) {
                    currentZone.push(pt);
                } else {
                    zones.push(this.compileZone(currentZone, avgVolumePerBin));
                    currentZone = [pt];
                }
            }
        }
        if (currentZone.length > 0) zones.push(this.compileZone(currentZone, avgVolumePerBin));

        // Layer 5 & 6 rules
        const processedZones = zones.map(z => {
            const mid = (z.top + z.bottom) / 2;
            const distPct = (Math.abs(mid - currentPrice) / currentPrice) * 100;
            
            z.distFromPricePct = parseFloat(distPct.toFixed(2));
            z.isExtremelyNear = distPct < 0.5;
            
            if (z.score >= 85) z.rank = 'S';
            else if (z.score >= 70) z.rank = 'A';
            else if (z.score >= 55) z.rank = 'B';
            else z.rank = 'C';
            
            return z;
        });

        const filteredZones = processedZones.filter(z => {
            // V4 Spec: Allow showing zones up to 15% away, and even extremely near ones.
            // But we might want to hide very far ones or very weak ones.
            return (z.distFromPricePct || 0) <= 15 && z.score > 20;
        });
        
        // --- LIVE DEFEND REACTION SCORE (Order Flow Verified v3.0) ---
        const recentKlines = timeframeData['15m'] || timeframeData['1h'] || [];
        if (recentKlines.length > 50) {
            const lastKlines = recentKlines.slice(-10);
            const recentAvgVol = recentKlines.slice(-50).reduce((a,b)=>a+b.volume, 0) / 50;
            
            for (const z of filteredZones) {
                let defendPoints = 0;
                for (let i = 0; i < lastKlines.length; i++) {
                    const k = lastKlines[i];
                    // Check if wick or body touches the zone
                    if ((k.high >= z.bottom && k.low <= z.top)) {
                        const bodyTop = Math.max(k.open, k.close);
                        const bodyBot = Math.min(k.open, k.close);
                        const lowerWick = bodyBot - k.low;
                        const upperWick = k.high - bodyTop;
                        const body = Math.abs(k.close - k.open) || 0.0001;
                        const isGreen = k.close > k.open;
                        
                        // Rule 1: Support rejection (Shadow + Volume + Green Recovery)
                        if (currentPrice >= z.top && lowerWick > body * 1.5 && k.volume > recentAvgVol * 1.2) {
                            defendPoints += 30;
                            if (isGreen) defendPoints += 10;
                        }
                        // Rule 2: Resistance rejection (Shadow + Volume + Red Recovery)
                        else if (currentPrice <= z.bottom && upperWick > body * 1.5 && k.volume > recentAvgVol * 1.2) {
                            defendPoints += 30;
                            if (!isGreen) defendPoints += 10;
                        }

                        // Rule 3: Persistence (Price didn't break through in next candles)
                        // Simple check: current price is still on the correct side
                        if (currentPrice > z.top) defendPoints += 10; 
                        else if (currentPrice < z.bottom) defendPoints += 10;
                    }
                }
                z.defendReactionScore = Math.min(100, defendPoints);
            }
        }
        // R1-L4: EMA 200 Bonus applied to final score
        let ema200Trend = 'neutral';
        const referenceTf = timeframeData['1h'] || timeframeData['4h'] || timeframeData['15m'];
        if (referenceTf && referenceTf.length > 0) {
            const ema200 = this.calculateEMA(referenceTf, 200);
            const latestEma = ema200[ema200.length - 1];
            ema200Trend = currentPrice > latestEma ? 'bullish' : 'bearish';
        }

        filteredZones.forEach(z => {
            const anchorRole = currentPrice > z.top ? 'support' : 'resistance';
            if (z.score >= 55 && ema200Trend !== 'neutral') {
                const aligned = (anchorRole === 'support' && ema200Trend === 'bullish') || 
                                (anchorRole === 'resistance' && ema200Trend === 'bearish');
                if (aligned) z.score = Math.min(100, z.score + 5);
                else z.score = Math.max(0, z.score - 5);
            }
        });

        return filteredZones.sort((a,b) => b.score - a.score);
    }

    private compileZone(points: PriceMemory[], avgVol: number): Zone {
        const top = Math.max(...points.map(p => p.price));
        const bottom = Math.min(...points.map(p => p.price));
        const width = top - bottom || 0.0001;
        
        let tCount = 0;
        let tCount30d = 0;
        let dCount = 0;
        let bCount = 0;
        let vol = 0;
        let latestTouch = 0;
        const tfSet = new Set<string>();

        let maxVol = -1;
        let poc = (top + bottom) / 2;

        for (const p of points) {
            tCount += p.touchCount;
            tCount30d += p.touchCount30d;
            dCount += p.defendCount;
            bCount += p.breakCount;
            vol += p.totalVolume;
            if (p.lastTouch > latestTouch) latestTouch = p.lastTouch;
            p.timeframeHits.forEach(t => tfSet.add(t));

            if (p.totalVolume > maxVol) {
                maxVol = p.totalVolume;
                poc = p.price;
            }
        }

        const defendRate = dCount / (dCount + bCount || 1);
        const volumeRatio = vol / (avgVol * points.length || 1);
        
        // --- V4 Pro: Density Score ---
        const densityScore = (tCount * volumeRatio) / (width / ((top + bottom) / 2) * 1000); 

        // --- New Scoring Logic (v2.0) ---
        // 1. Time Decay (20%)
        let timeScore = 0;
        const daysSinceLastTouch = (Date.now() - latestTouch) / 86400000;
        if (daysSinceLastTouch <= 7) timeScore = 20;
        else if (daysSinceLastTouch <= 14) timeScore = 15;
        else if (daysSinceLastTouch <= 30) timeScore = 8;

        // 2. Breach Penalty (15%)
        let breachScore = 0;
        if (bCount === 0) breachScore = 15;
        else if (bCount === 1) breachScore = 8;
        else if (bCount === 2) breachScore = 3;

        // 3. Timeframe Resonance (20%)
        let tfScore = 0;
        const tfCount = tfSet.size;
        if (tfCount >= 4) tfScore = 20;
        else if (tfCount === 3) tfScore = 15;
        else if (tfCount === 2) tfScore = 8;

        // 4. Density & Volume (30%)
        let volDensityScore = 0;
        if (densityScore > 10) volDensityScore = 30;
        else if (densityScore > 5) volDensityScore = 20;
        else if (densityScore > 2) volDensityScore = 10;

        // 5. Defend Rate (15%) - R1-L1 Optimization
        let freqScore = 0;
        if (defendRate >= 0.80) freqScore = 15;
        else if (defendRate >= 0.60) freqScore = 10;
        else if (defendRate >= 0.40) freqScore = 5;

        // 6. Width Penalty (V4 Pro)
        let widthPenalty = 0;
        const widthPct = (width / ((top + bottom) / 2)) * 100;
        if (widthPct > 2.0) widthPenalty = 20;
        else if (widthPct > 1.0) widthPenalty = 10;

        const score = timeScore + breachScore + tfScore + volDensityScore + freqScore - widthPenalty;

        return {
            top,
            bottom,
            poc,
            score: Math.min(100, Math.max(0, score)),
            densityScore,
            defendRate,
            touchCount: tCount,
            volumeStrength: volumeRatio,
            timeframes: Array.from(tfSet),
            defendReactionScore: 0 
        };
    }
}

// R4-3-A/B: Anchor Gap Analyzer
// Finds gaps between high-scoring support zones, uses ATR-normalized risk levels
export class AnchorGapAnalyzer {
    /**
     * R4-3-B: calcRiskLevel uses ATR multiples instead of fixed gapPct thresholds
     * so risk is consistent across different volatility regimes.
     */
    private calcRiskLevel(gapPct: number, gapLiquidity: number, atr14: number, currentPrice: number): GapRiskLevel {
        const gapAbs   = (gapPct / 100) * currentPrice;
        const gapInATR = atr14 > 0 ? gapAbs / atr14 : 0;

        const sizeScore  = gapInATR >= 3 ? 'large'  : gapInATR >= 1.5 ? 'medium' : 'small';
        const liquidScore = gapLiquidity < 5_000_000 ? 'low'
                          : gapLiquidity < 20_000_000 ? 'medium' : 'high';

        const matrix: Record<string, Record<string, GapRiskLevel>> = {
            large:  { low: 'CRITICAL', medium: 'HIGH',   high: 'MEDIUM' },
            medium: { low: 'HIGH',     medium: 'MEDIUM',  high: 'LOW'    },
            small:  { low: 'MEDIUM',   medium: 'LOW',     high: 'LOW'    },
        };
        return matrix[sizeScore][liquidScore];
    }

    /**
     * @param zones         Output of AnchorEngine.processTimeframes()
     * @param liveWalls     Active liquidity zones from LiquidityEngine.getActiveZones()
     * @param currentPrice  Current market price
     * @param atr14         14-period Median ATR (from AnchorEngine's calculateATR)
     */
    analyzeGaps(
        zones: Zone[],
        liveWalls: Array<{ top: number; bottom: number; totalUsd?: number; lastSeenMs?: number; spoofScore?: number }>,
        currentPrice: number,
        atr14: number,
    ): AnchorGap[] {
        const now = Date.now();
        const FRESH_WALL_MAX_AGE = 30_000; // R4-3-A: 30 second freshness filter

        // R4-3-A: Only count walls with recent updates and non-spoofed
        const freshWalls = liveWalls.filter(w =>
            (w.lastSeenMs ? now - w.lastSeenMs <= FRESH_WALL_MAX_AGE : true) &&
            (w.spoofScore !== undefined ? w.spoofScore < 40 : true)
        );

        // Only analyze support zones with score >= 70 below current price
        const supports = zones
            .filter(z => z.score >= 70 && z.top < currentPrice)
            .sort((a, b) => b.top - a.top); // highest first

        const gaps: AnchorGap[] = [];

        for (let i = 0; i < supports.length - 1; i++) {
            const upper = supports[i];
            const lower = supports[i + 1];
            const gapPct = (upper.bottom - lower.top) / upper.bottom * 100;

            if (gapPct < 1.0) continue; // skip tiny gaps

            // R4-3-A: Use freshWalls for liquidity in gap
            const wallsInGap = freshWalls.filter(w =>
                w.top < upper.bottom && w.bottom > lower.top
            );
            const totalWallsInGap = liveWalls.filter(w =>
                w.top < upper.bottom && w.bottom > lower.top
            );
            const gapLiquidity = wallsInGap.reduce((s, w) => s + (w.totalUsd || 0), 0);
            const freshnessRatio = totalWallsInGap.length > 0
                ? wallsInGap.length / totalWallsInGap.length
                : 1;

            const gapAbs   = (gapPct / 100) * currentPrice;
            const gapInATR = atr14 > 0 ? gapAbs / atr14 : 0;

            gaps.push({
                upperZone: upper,
                lowerZone: lower,
                gapPct: parseFloat(gapPct.toFixed(2)),
                gapInATR: parseFloat(gapInATR.toFixed(2)),
                gapLiquidity,
                freshnessRatio: parseFloat(freshnessRatio.toFixed(2)),
                riskLevel: this.calcRiskLevel(gapPct, gapLiquidity, atr14, currentPrice),
                targetIfBreached: lower.poc,
            });
        }

        const order: Record<GapRiskLevel, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return gaps.sort((a, b) => order[a.riskLevel] - order[b.riskLevel]);
    }
}
