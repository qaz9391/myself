import type { Zone } from './anchorEngine';
import type { KLine } from './anchorEngine';

export interface PressureZone {
    price: number;
    type: '上方' | '下方';
    reason: string; // "前高流動性 / 多次插針區 / 假突破誘空區"
    confidence: number;
    isTriggered?: boolean;
}

export class TrapDetector {
    static findLiquidityPressureZones(
        currentPrice: number,
        zones: Zone[],
        recentKlines: KLine[] // Expecting 1h or 15m
    ): PressureZone[] {
        const pressureZones: PressureZone[] = [];

        // 1. Convert zones to potential trap targets
        for (const z of zones) {
            const mid = (z.top + z.bottom) / 2;
            const dist = Math.abs(mid - currentPrice) / currentPrice;
            
            // Only care about zones within 0.5% ~ 10%
            if (dist < 0.005 || dist > 0.1) continue;

            const isAbove = mid > currentPrice;
            let reason = isAbove ? "前高流動性" : "前低流動性";
            let confidence = z.score;

            // 2. Check wicks in recent K-lines (多次插針)
            let wickCount = 0;
            let fakeoutCount = 0;

            for (const k of recentKlines.slice(-30)) { // look at last 30 bars
                const bodyTop = Math.max(k.open, k.close);
                const bodyBot = Math.min(k.open, k.close);
                
                // If it's a resistance (above us)
                if (isAbove) {
                    if (k.high >= z.bottom && bodyTop <= z.bottom) {
                        wickCount++; // Touched and rejected
                    }
                    if (k.high > z.top && k.close < z.bottom) {
                        fakeoutCount++; // Pierced top but closed below bottom (Fake Breakout)
                    }
                } 
                // If it's a support (below us)
                else {
                    if (k.low <= z.top && bodyBot >= z.top) {
                        wickCount++;
                    }
                    if (k.low < z.bottom && k.close > z.top) {
                        fakeoutCount++;
                    }
                }
            }

            // 3. V4 Pro: Trap Trigger Logic
            let isTriggered = false;
            if (fakeoutCount > 0) {
                reason = isAbove ? "假突破誘多區 (Trap)" : "假跌破誘空區 (Trap)";
                confidence += 20;

                const lastK = recentKlines[recentKlines.length - 1];
                const prevK = recentKlines[recentKlines.length - 2];
                const avgVol = recentKlines.slice(-20).reduce((s,x)=>s+x.volume, 0) / 20;

                if (isAbove) {
                    // Break top, then retrace deep
                    const broke = prevK.high > z.top || lastK.high > z.top;
                    const retrace = (lastK.high - lastK.close) / (lastK.high - z.bottom || 0.0001);
                    if (broke && retrace > 0.7 && lastK.volume > avgVol * 1.5) {
                        isTriggered = true;
                        reason = "🔥 Trap Triggered: 誘多獵殺";
                    }
                } else {
                    const broke = prevK.low < z.bottom || lastK.low < z.bottom;
                    const retrace = (lastK.close - lastK.low) / (z.top - lastK.low || 0.0001);
                    if (broke && retrace > 0.7 && lastK.volume > avgVol * 1.5) {
                        isTriggered = true;
                        reason = "🔥 Trap Triggered: 誘空獵殺";
                    }
                }
            } else if (wickCount >= 2) {
                reason = "多次插針區 (Wicks)";
                confidence += 10;
            } else if (z.volumeStrength >= 2) {
                reason = "成交量激增區 (Heavy Vol)";
                confidence += 5;
            }

            pressureZones.push({
                price: mid,
                type: isAbove ? '上方' : '下方',
                reason,
                confidence: Math.min(100, confidence),
                isTriggered
            });
        }

        // Sort by confidence, return top above and top below
        const sorted = pressureZones.sort((a,b) => b.confidence - a.confidence);
        const topAbove = sorted.find(p => p.type === '上方');
        const topBelow = sorted.find(p => p.type === '下方');

        const results = [];
        if (topAbove) results.push(topAbove);
        if (topBelow) results.push(topBelow);

        return results;
    }
}
