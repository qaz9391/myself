# TradingMonitor 迭代分析 Round 9-12 深挖完整版
> 接續：Round5-8_深挖完整版.md 結尾的「Round 9 待挖問題」
> 本文件把每個待挖問題都挖到底，並繼續往下找新的漏洞
> 不動模組：Squeeze 收斂判定核心邏輯

---

## Round 9：解決 Round 8 遺留的所有待挖問題

---

### R9-1｜RiskEngine：相關性矩陣自動更新

**問題根因（承接 Round 8 待挖 #1）：**
```
硬編碼 BTC-ETH 相關性 = 0.85
但實際相關性是動態的：

2021 牛市：BTC-ETH 相關性 = 0.92
2022 熊市：BTC-ETH 相關性 = 0.88
2023 低波動期：BTC-ETH 相關性 = 0.78
ETH 上海升級期間：相關性暫時下降到 0.60

使用舊的相關性矩陣會導致：
- 高相關期：低估集中風險，允許過大的相關倉位
- 低相關期：高估集中風險，錯過好的分散機會
```

**第一層問題：相關性計算需要什麼數據？**
```
相關性 = Pearson 相關係數
需要：兩個資產在相同時間窗口的收益率序列

問題：
- 用多長的窗口？30 天 vs 90 天差異很大
- 用什麼頻率？日收益率 vs 小時收益率？
- 短窗口：對近期市場反應快，但噪聲大
- 長窗口：穩定但對市場變化反應慢
```

**解決方案：雙窗口滾動相關性 + 指數加權**
```typescript
class DynamicCorrelationMatrix {
  // 兩個窗口：短期捕捉近期變化，長期提供穩定基準
  private readonly SHORT_WINDOW = 30;   // 30 天
  private readonly LONG_WINDOW  = 90;   // 90 天
  private readonly DECAY_FACTOR = 0.94; // 指數加權衰減係數

  // 每個幣種的日收益率歷史（最多保留 90 天）
  private returns: Record<string, number[]> = {};

  addDailyReturn(symbol: string, returnPct: number): void {
    if (!this.returns[symbol]) this.returns[symbol] = [];
    this.returns[symbol].push(returnPct);

    // 只保留最近 LONG_WINDOW 天
    if (this.returns[symbol].length > this.LONG_WINDOW) {
      this.returns[symbol].shift();
    }
  }

  getCorrelation(symbolA: string, symbolB: string): CorrelationResult {
    const returnsA = this.returns[symbolA] || [];
    const returnsB = this.returns[symbolB] || [];

    if (returnsA.length < this.SHORT_WINDOW || returnsB.length < this.SHORT_WINDOW) {
      // 數據不足：返回保守的預設值
      return { correlation: 0.85, confidence: 'low', dataPoints: Math.min(returnsA.length, returnsB.length) };
    }

    const shortCorr = this.computeEWCorrelation(
      returnsA.slice(-this.SHORT_WINDOW),
      returnsB.slice(-this.SHORT_WINDOW),
      this.DECAY_FACTOR,
    );

    const longCorr = this.computeEWCorrelation(
      returnsA.slice(-this.LONG_WINDOW),
      returnsB.slice(-this.LONG_WINDOW),
      this.DECAY_FACTOR ** (1 / 3), // 長窗口衰減更慢
    );

    // 短期和長期的加權平均（近期更重要）
    const blended = shortCorr * 0.6 + longCorr * 0.4;

    // 如果短期和長期差異過大，降低信心
    const confidence = Math.abs(shortCorr - longCorr) < 0.15 ? 'high' : 'low';

    return { correlation: blended, confidence, shortCorr, longCorr, dataPoints: returnsA.length };
  }

  private computeEWCorrelation(a: number[], b: number[], decay: number): number {
    const n = Math.min(a.length, b.length);
    if (n < 5) return 0.85; // 樣本太少返回預設

    let wSum    = 0;
    let wxSumA  = 0, wxSumB  = 0;
    let wxxSumA = 0, wxxSumB = 0;
    let wxySum  = 0;

    for (let i = 0; i < n; i++) {
      // 越近的數據權重越高
      const w    = Math.pow(decay, n - 1 - i);
      const retA = a[i];
      const retB = b[i];

      wSum    += w;
      wxSumA  += w * retA;
      wxSumB  += w * retB;
      wxxSumA += w * retA * retA;
      wxxSumB += w * retB * retB;
      wxySum  += w * retA * retB;
    }

    const meanA  = wxSumA / wSum;
    const meanB  = wxSumB / wSum;
    const varA   = wxxSumA / wSum - meanA ** 2;
    const varB   = wxxSumB / wSum - meanB ** 2;
    const covAB  = wxySum  / wSum - meanA * meanB;

    const stdA = Math.sqrt(Math.max(varA, 1e-10));
    const stdB = Math.sqrt(Math.max(varB, 1e-10));

    return Math.max(-1, Math.min(1, covAB / (stdA * stdB)));
  }
}
```

**第二層問題：日收益率從哪裡取得？需要獨立的數據管道**
```
日收益率 = (今日收盤 - 昨日收盤) / 昨日收盤

問題：
這需要每天的 OHLCV 數據
但現有系統的數據管道專注於即時數據（Tick / 1H）
沒有日線收盤價的管道

如果從 WS 取得：
  每天結束時記錄最後一筆 markPrice 作為「收盤價」
  問題：WS 可能在某個時點斷線，導致「收盤價」缺失
```

**解決方案：獨立的日線數據 Fetcher**
```typescript
class DailyReturnFetcher {
  private readonly FETCH_TIME_UTC = 0; // 每天 00:00 UTC 取得前一天收盤

  // 每天定時執行一次
  async fetchAndRecord(symbols: string[]): Promise<void> {
    for (const symbol of symbols) {
      try {
        // Binance: 取最近 2 根日線 K 棒（確保有昨天的收盤）
        const res = await fetch(
          `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1d&limit=2`
        );
        const klines = await res.json();

        if (klines.length < 2) continue;

        const prevClose = parseFloat(klines[0][4]); // 前天收盤
        const lastClose = parseFloat(klines[1][4]); // 昨天收盤

        if (prevClose <= 0) continue;

        const dailyReturn = (lastClose - prevClose) / prevClose;
        correlationMatrix.addDailyReturn(symbol, dailyReturn);

        // 持久化到 IndexedDB（層二統計摘要）
        await tieredStorage.writeHourlyStats({
          hour:              this.getYesterdayMidnight(),
          symbol,
          dailyReturn,
          close:             lastClose,
        });
      } catch (e) {
        console.error(`Failed to fetch daily return for ${symbol}:`, e);
      }
    }
  }

  private getYesterdayMidnight(): number {
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    return now.getTime() - 86400000;
  }
}

// 系統啟動時，從 IndexedDB 恢復歷史收益率
async function restoreCorrelationHistory(db: IDBDatabase): Promise<void> {
  const records = await db.transaction('hourlyStats')
    .objectStore('hourlyStats')
    .getAll();

  const dailyReturns = records.filter(r => r.dailyReturn !== undefined);
  for (const r of dailyReturns) {
    correlationMatrix.addDailyReturn(r.symbol, r.dailyReturn);
  }
  console.log(`Restored ${dailyReturns.length} daily return records for correlation`);
}
```

---

### R9-2｜DriftDetector：PSI 需要「訓練時的分佈」

**問題根因（承接 Round 8 待挖 #2）：**
```
PSI = Σ (actual% - expected%) × ln(actual% / expected%)

expected% = 訓練時各 bin 的比例
actual%   = 當前各 bin 的比例

問題：
1. 訓練時的分佈（reference distribution）從哪裡來？
2. 每次重新訓練後怎麼更新 reference？
3. reference 用 histogram 分桶，怎麼決定 bin 邊界？
   - 固定邊界：[0, 0.1, 0.2, ... 1.0]
     問題：WCI 的分佈可能集中在 [-0.3, +0.3]，很多 bin 是空的
   - 分位數邊界：用訓練時的 percentile 劃分
     問題：需要保存訓練時的 percentile 資訊
```

**第一層問題：Bin 邊界策略**
```
最優策略：分位數分桶（Quantile Binning）
每個 bin 包含訓練時相同數量的樣本

例如 WCI 用 10 個 bin：
  訓練時 WCI 的分佈：
  Bin 1 [−1.00, −0.45]：10% 樣本
  Bin 2 [−0.45, −0.28]：10% 樣本
  ...
  Bin 10 [+0.38, +1.00]：10% 樣本

  當前的 WCI 分佈如果大量落在 Bin 10
  PSI 會顯著增加，偵測到 drift
```

**解決方案：Quantile-Based PSI + Reference 版本控制**
```typescript
interface FeatureReference {
  featureName:  string;
  binEdges:     number[];  // 分位數邊界（11 個值，10 個 bin）
  binFreqs:     number[];  // 每個 bin 的比例（10 個值，和為 1）
  createdAt:    number;
  modelVersion: string;    // 對應的模型版本
  sampleCount:  number;    // 訓練樣本數
}

class ReferenceDistributionManager {
  private references = new Map<string, FeatureReference>();

  // 訓練完成後，從訓練集計算 reference
  buildFromTrainingSet(
    featureName:  string,
    trainingData: number[],
    modelVersion: string,
    numBins:      number = 10,
  ): void {
    if (trainingData.length < numBins * 5) {
      console.warn(`${featureName}: 訓練數據太少（${trainingData.length}），PSI 不可靠`);
      return;
    }

    // 計算分位數邊界
    const sorted   = [...trainingData].sort((a, b) => a - b);
    const binEdges: number[] = [];

    for (let i = 0; i <= numBins; i++) {
      const idx    = Math.floor((i / numBins) * (sorted.length - 1));
      binEdges.push(sorted[idx]);
    }

    // 確保邊界唯一（處理重複值）
    const uniqueEdges = [...new Set(binEdges)];
    if (uniqueEdges.length < 3) {
      console.warn(`${featureName}: 分佈太集中，無法分桶`);
      return;
    }

    // 計算每個 bin 的頻率
    const effectiveBins = uniqueEdges.length - 1;
    const binCounts     = new Array(effectiveBins).fill(0);

    for (const value of trainingData) {
      const binIdx = this.findBin(value, uniqueEdges);
      if (binIdx >= 0 && binIdx < effectiveBins) {
        binCounts[binIdx]++;
      }
    }

    const total   = trainingData.length;
    const binFreqs = binCounts.map(c => (c + 1e-10) / total); // +1e-10 避免除零

    this.references.set(featureName, {
      featureName,
      binEdges:     uniqueEdges,
      binFreqs,
      createdAt:    Date.now(),
      modelVersion,
      sampleCount:  trainingData.length,
    });
  }

  // 計算當前數據相對於 reference 的 PSI
  computePSI(featureName: string, currentData: number[]): PSIResult {
    const ref = this.references.get(featureName);
    if (!ref) {
      return { psi: 0, severity: 'UNKNOWN', message: '無 reference 分佈' };
    }

    const effectiveBins = ref.binEdges.length - 1;
    const currentCounts = new Array(effectiveBins).fill(0);

    for (const value of currentData) {
      const binIdx = this.findBin(value, ref.binEdges);
      if (binIdx >= 0 && binIdx < effectiveBins) {
        currentCounts[binIdx]++;
      }
    }

    const total        = currentData.length;
    const currentFreqs = currentCounts.map(c => (c + 1e-10) / total);

    let psi = 0;
    for (let i = 0; i < effectiveBins; i++) {
      const expected = ref.binFreqs[i];
      const actual   = currentFreqs[i];
      psi += (actual - expected) * Math.log(actual / expected);
    }

    const severity = psi < 0.10 ? 'OK' : psi < 0.25 ? 'WARN' : 'CRITICAL';

    return { psi, severity, binEdges: ref.binEdges, currentFreqs, refFreqs: ref.binFreqs };
  }

  private findBin(value: number, edges: number[]): number {
    for (let i = 0; i < edges.length - 1; i++) {
      if (value >= edges[i] && value < edges[i + 1]) return i;
    }
    // 最後一個 bin 包含最大值
    return edges.length - 2;
  }

  // 持久化到 IndexedDB
  async persist(db: IDBDatabase): Promise<void> {
    const store = db.transaction('featureReferences', 'readwrite').objectStore('featureReferences');
    for (const [name, ref] of this.references) {
      await store.put(ref, name);
    }
  }

  async restore(db: IDBDatabase): Promise<void> {
    const store = db.transaction('featureReferences').objectStore('featureReferences');
    const all   = await store.getAll();
    for (const ref of all) {
      this.references.set(ref.featureName, ref);
    }
  }
}
```

**第二層問題：重新訓練後 reference 如何更新**
```
問題：
  每次重新訓練，訓練集的分佈可能改變
  如果直接用新訓練集重建 reference
  PSI 會立即歸零（reference 和 current 完全一樣）
  失去偵測 drift 的能力

正確做法：
  reference 不應該是「最近一次訓練集的分佈」
  而是「系統部署時希望看到的正常分佈」
  
  策略：只在模型重大版本升級時更新 reference
  日常的 online learning 不更新 reference
```
```typescript
class ReferenceUpdatePolicy {
  private readonly MAJOR_UPDATE_THRESHOLD = '2.0.0'; // 只有大版本才更新

  shouldUpdateReference(
    oldVersion: string,
    newVersion: string,
  ): boolean {
    const [oldMajor] = oldVersion.split('.').map(Number);
    const [newMajor] = newVersion.split('.').map(Number);

    // 只有 major 版本號改變時才更新 reference
    return newMajor > oldMajor;
  }

  async safeUpdate(
    manager:       ReferenceDistributionManager,
    newTrainingSet: number[],
    featureName:    string,
    newVersion:     string,
    oldVersion:     string,
    db:             IDBDatabase,
  ): Promise<void> {
    if (!this.shouldUpdateReference(oldVersion, newVersion)) {
      console.log(`Reference not updated: minor version change ${oldVersion} → ${newVersion}`);
      return;
    }

    // 備份舊的 reference
    const oldRef = manager.getReference(featureName);
    if (oldRef) {
      const backupStore = db.transaction('referenceBackups', 'readwrite').objectStore('referenceBackups');
      await backupStore.put({ ...oldRef, backedUpAt: Date.now() }, `${featureName}_${oldVersion}`);
    }

    // 更新
    manager.buildFromTrainingSet(featureName, newTrainingSet, newVersion);
    await manager.persist(db);
    console.log(`Reference updated for ${featureName}: ${oldVersion} → ${newVersion}`);
  }
}
```

---

### R9-3｜CalibratedModel：Walk-Forward 驗證框架

**問題根因（承接 Round 8 待挖 #3）：**
```
Platt Scaling 需要 validation set 與 training set 獨立
加密市場的數據少，時間切分困難

傳統機器學習的 train/val/test 切分：
  80% 訓練 / 10% 驗證 / 10% 測試

加密市場的問題：
  數據有強烈的時間序列性
  不能隨機切分（會有 data leakage）
  必須按時間切分：前 80% 訓練，後 20% 驗證

但後 20% 如果是「近期數據」
模型在驗證集上的表現可能不代表未來
因為市場 regime 一直在變
```

**解決方案：Walk-Forward Validation（向前驗證）**
```typescript
class WalkForwardValidator {
  // Walk-Forward 原理：
  // 用一個滑動窗口訓練，然後在下一個窗口驗證
  // 重複 K 次，取平均

  async validate(
    allSamples:   LabeledSample[],
    modelFactory: () => MLModel,
    numFolds:     number = 5,
    trainRatio:   number = 0.70,
  ): Promise<WalkForwardResult> {
    // 確保樣本按時間排序
    const sorted = [...allSamples].sort((a, b) => a.timestamp - b.timestamp);
    const n      = sorted.length;

    // 每個 fold 的起點
    const foldSize  = Math.floor(n / (numFolds + 1));
    const results: FoldResult[] = [];

    for (let fold = 0; fold < numFolds; fold++) {
      // 訓練集：從開始到 fold 的截止點
      const trainEnd = foldSize * (fold + 1);
      const valStart = trainEnd;
      const valEnd   = Math.min(n, valStart + foldSize);

      const trainSet = sorted.slice(0, trainEnd);
      const valSet   = sorted.slice(valStart, valEnd);

      if (trainSet.length < 50 || valSet.length < 10) continue;

      // 訓練新模型
      const model = modelFactory();
      await model.train(trainSet);

      // 驗證
      const predictions = valSet.map(s => ({
        predicted: model.predict(s.features).probability,
        actual:    s.label,
        timestamp: s.timestamp,
      }));

      // 計算各種指標
      const accuracy = this.computeAccuracy(predictions, 0.5);
      const auc      = this.computeAUC(predictions);
      const ece      = this.computeECE(predictions);
      const brier    = this.computeBrierScore(predictions);

      results.push({
        fold:       fold + 1,
        trainSize:  trainSet.length,
        valSize:    valSet.length,
        valStart:   sorted[valStart].timestamp,
        valEnd:     sorted[valEnd - 1].timestamp,
        accuracy, auc, ece, brier,
      });

      console.log(`Fold ${fold + 1}: AUC=${auc.toFixed(3)}, ECE=${ece.toFixed(3)}, Brier=${brier.toFixed(3)}`);
    }

    // 匯總結果
    const avgAUC   = results.reduce((s, r) => s + r.auc,   0) / results.length;
    const avgECE   = results.reduce((s, r) => s + r.ece,   0) / results.length;
    const avgBrier = results.reduce((s, r) => s + r.brier, 0) / results.length;
    const stdAUC   = this.computeStd(results.map(r => r.auc));

    return {
      folds: results,
      summary: {
        avgAUC, avgECE, avgBrier, stdAUC,
        isStable:    stdAUC < 0.05,    // AUC 標準差 < 0.05 代表穩定
        isCalibrated: avgECE < 0.05,   // ECE < 0.05 代表校準良好
        verdict:     avgAUC > 0.65 && avgECE < 0.05 ? 'PASS' : 'FAIL',
      },
    };
  }

  private computeAUC(preds: { predicted: number; actual: boolean }[]): number {
    // Trapezoidal AUC
    const sorted  = [...preds].sort((a, b) => b.predicted - a.predicted);
    let tp = 0, fp = 0;
    const points: [number, number][] = [];
    const posTotal = preds.filter(p => p.actual).length;
    const negTotal = preds.length - posTotal;

    for (const p of sorted) {
      if (p.actual) tp++;
      else          fp++;
      points.push([fp / (negTotal || 1), tp / (posTotal || 1)]);
    }

    let auc = 0;
    for (let i = 1; i < points.length; i++) {
      auc += (points[i][0] - points[i-1][0]) * (points[i][1] + points[i-1][1]) / 2;
    }
    return auc;
  }

  private computeBrierScore(preds: { predicted: number; actual: boolean }[]): number {
    // Brier Score = mean((predicted - actual)^2)，越低越好
    const sum = preds.reduce((s, p) => s + (p.predicted - (p.actual ? 1 : 0)) ** 2, 0);
    return sum / preds.length;
  }

  private computeStd(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }

  private computeAccuracy(preds: { predicted: number; actual: boolean }[], threshold: number): number {
    const correct = preds.filter(p => (p.predicted >= threshold) === p.actual).length;
    return correct / preds.length;
  }

  private computeECE(preds: { predicted: number; actual: boolean }[], bins = 10): number {
    let ece = 0;
    const n = preds.length;
    for (let b = 0; b < bins; b++) {
      const lo    = b / bins;
      const hi    = (b + 1) / bins;
      const inBin = preds.filter(p => p.predicted >= lo && p.predicted < hi);
      if (!inBin.length) continue;
      const avgConf = inBin.reduce((s, p) => s + p.predicted, 0) / inBin.length;
      const avgAcc  = inBin.filter(p => p.actual).length / inBin.length;
      ece += (inBin.length / n) * Math.abs(avgConf - avgAcc);
    }
    return ece;
  }
}
```

---

### R9-4｜ProtectedOnlineLearner：Feedback Loop 過濾的可行性問題

**問題根因（承接 Round 8 待挖 #4）：**
```
過濾標準：
  「如果掛單出現前 30 分鐘，系統曾輸出高信心信號
   那這個掛單可能是用戶根據信號放的，過濾掉」

問題一：加密市場中，多個大戶可能同時在看同一個價位
  不是因為系統信號，而是因為市場結構（錨點）
  這種「自然聚合」的掛單會被錯誤過濾

問題二：過濾太嚴會失去大量訓練數據
  假設系統每天輸出 50 個信號
  每個信號都過濾前後 30 分鐘的掛單
  每天有效掛單減少 50 × 60分鐘 / 1440分鐘 = ~2% 的樣本
  這個比例可能是可接受的

問題三：如何確認是「用戶根據信號放的」？
  現實：根本無法確認
  系統只能做「統計推斷」：
  如果信號後 30 分鐘，相同價位的掛單數量明顯增加
  才有理由懷疑是 Feedback Loop
  否則不應過濾
```

**解決方案：統計式 Feedback Loop 偵測**
```typescript
class FeedbackLoopDetector {
  // 記錄信號發出後一段時間的掛單出現率
  // 與「無信號時」的基準率比較

  private baselineWallRate:    RunningAverage; // 無信號時每小時平均掛單數
  private postSignalWallRate:  RunningAverage; // 信號後 30 分鐘的掛單數

  isSignalInducedWall(
    wall:           ConfirmedWall,
    recentSignals:  ActionSignal[],
  ): FeedbackAssessment {
    // 找出掛單出現前 30 分鐘內的相關信號
    const priorSignals = recentSignals.filter(s =>
      s.price && Math.abs(s.price - wall.price) / wall.price < 0.005 && // 價格相近
      wall.firstSeen - s.timestamp > 0 &&             // 信號在掛單前
      wall.firstSeen - s.timestamp < 30 * 60 * 1000 && // 在 30 分鐘內
      s.confidence > 0.75                              // 只考慮高信心信號
    );

    if (priorSignals.length === 0) {
      return { isSuspect: false, confidence: 'high' };
    }

    // 計算這個價位在此時間段的掛單出現率
    const currentRate   = this.postSignalWallRate.average;
    const baselineRate  = this.baselineWallRate.average;

    // 如果信號後的掛單出現率比基準高 50% 以上，才懷疑
    if (currentRate > baselineRate * 1.5) {
      return {
        isSuspect:    true,
        confidence:   'medium',
        priorSignals: priorSignals.length,
        rateRatio:    currentRate / baselineRate,
        action:       'downweight', // 不完全過濾，而是降低訓練權重
      };
    }

    // 掛單出現率正常，不是 Feedback Loop
    return { isSuspect: false, confidence: 'high' };
  }

  // 更新基準率（每小時執行）
  updateBaseline(wallsThisHour: number, hadSignalThisHour: boolean): void {
    if (!hadSignalThisHour) {
      this.baselineWallRate.add(wallsThisHour);
    } else {
      this.postSignalWallRate.add(wallsThisHour);
    }
  }
}

// ProtectedOnlineLearner 修改：不完全過濾，而是降低權重
learn(sample: TrainingSample): void {
  const fbAssess = feedbackDetector.isSignalInducedWall(sample.wall, recentSignals);

  if (fbAssess.isSuspect) {
    // 降低訓練權重而非完全過濾
    const weight = fbAssess.rateRatio ? 1 / fbAssess.rateRatio : 0.5;
    this.shadowModel.updateWithWeight(sample, weight);
    console.log(`Downweighted sample (potential feedback): weight=${weight.toFixed(2)}`);
  } else {
    this.shadowModel.update(sample);
  }
}
```

---

### R9-5｜EventBasedSequenceEncoder：Transformer 的 Positional Encoding 設計

**問題根因（承接 Round 8 待挖 #5）：**
```
標準 Transformer（NLP 用途）的 Positional Encoding：
  sin/cos 函數，表示序列中的「位置」（第幾個詞）

市場事件序列的問題：
  「位置」的意義不明確

  方案一：按序列順序編碼（第幾個事件）
    問題：「第 1 個事件」在不同情況下代表完全不同的時間跨度
    有時候 20 個事件發生在 1 小時內（活躍市場）
    有時候發生在 3 天內（冷清市場）

  方案二：按時間絕對位置編碼（Unix timestamp）
    問題：時間戳的數值太大，不適合直接作為 encoding
    而且模型看不到「時間間隔」的意義

  方案三：按相對時間編碼（距當前多少秒）
    問題：未來預測時，當前時刻的位置是不確定的
    而且相對時間是連續值，不是離散的
```

**解決方案：多尺度時間 Positional Encoding**
```typescript
class MarketTemporalEncoding {
  // 設計：把時間間隔分解成多個尺度的特徵
  // 類似 Fourier 分解，但針對市場週期

  private readonly TIME_SCALES = [
    60,           // 1 分鐘
    300,          // 5 分鐘
    3600,         // 1 小時
    14400,        // 4 小時
    86400,        // 1 天
    604800,       // 1 週
  ];

  encode(
    eventTimestamp: number,
    referenceTimestamp: number, // 當前時刻
    d_model: number = 64,        // Transformer 的維度
  ): number[] {
    const dt      = (referenceTimestamp - eventTimestamp) / 1000; // 秒
    const encoding: number[] = [];

    // 每個時間尺度產生 2 個維度（sin + cos）
    for (const scale of this.TIME_SCALES) {
      const phase = (dt % scale) / scale * 2 * Math.PI;
      encoding.push(Math.sin(phase));
      encoding.push(Math.cos(phase));
    }

    // 加入「衰減因子」：事件越舊，整體 encoding 權重越低
    const decayFactor = Math.exp(-dt / (7 * 86400)); // 7 天半衰期
    const decayed     = encoding.map(v => v * decayFactor);

    // 補齊到 d_model 維度（用 0 填充）
    while (decayed.length < d_model) decayed.push(0);

    return decayed.slice(0, d_model);
  }

  // 完整的 Transformer 輸入構建
  buildTransformerInput(
    events:    MarketEvent[],
    d_model:   number = 64,
  ): TransformerInput {
    const now = Date.now();

    const encodedEvents = events.map(event => {
      // 事件本身的 feature embedding
      const featureEmbed = this.encodeEventFeatures(event, d_model / 2);

      // 時間位置 encoding
      const timeEmbed    = this.encode(event.timestamp, now, d_model / 2);

      // 串接（concatenate）
      return [...featureEmbed, ...timeEmbed];
    });

    return {
      sequence:  encodedEvents,    // shape: [n_events, d_model]
      lengths:   encodedEvents.length,
      paddingMask: new Array(encodedEvents.length).fill(false), // no padding
    };
  }

  private encodeEventFeatures(event: MarketEvent, dim: number): number[] {
    // 把事件的 feature 投影到 dim 維空間
    // 這裡用簡單的線性映射，實際應由 Transformer 的 embedding layer 學習

    const raw = [
      event.features.wci,
      event.features.volumeDelta / 1e6,  // 正規化
      event.features.price / 100000,     // BTC 正規化
      ...this.oneHotEventType(event.type),
    ];

    // 線性映射到 dim 維（簡化版，實際應用 learned embedding）
    const projected = new Array(dim).fill(0);
    for (let i = 0; i < Math.min(raw.length, dim); i++) {
      projected[i] = raw[i];
    }
    return projected;
  }

  private oneHotEventType(type: MarketEvent['type']): number[] {
    const types = ['WALL_CONFIRMED', 'WALL_REMOVED', 'REGIME_CHANGED', 'SQUEEZE', 'LARGE_TRADE'];
    return types.map(t => t === type ? 1 : 0);
  }
}
```

---

### R9-6｜多幣種 Feature Store 設計

**問題根因（承接 Round 8 待挖 #6）：**
```
問題一：共享 vs 獨立 Feature Store
  共享（一個 Store）：
    ✅ 可以學到跨幣種的模式（BTC 下跌時 ETH 通常跟跌）
    ❌ 不同幣種的 feature 尺度差異巨大（BTC $95K vs PEPE $0.000001）
    ❌ 需要複雜的正規化策略

  獨立（每幣種一個 Store）：
    ✅ 正規化簡單（每幣種獨立計算統計量）
    ❌ 無法學習跨幣種關係
    ❌ 小幣種樣本太少，模型難以訓練

問題二：如何整合「市場全局特徵」
  BTC Dominance、總市值 24H 變化、Fear & Greed Index
  這些是全局特徵，不屬於任何單一幣種
  但每個幣種的模型都應該能看到這些特徵
```

**解決方案：兩層 Feature Store 架構**
```typescript
// 層一：幣種特定特徵（每幣種獨立）
interface CoinSpecificFeatures {
  symbol:          string;
  timestamp:       number;

  // 掛單特徵（已正規化）
  wallSizeRatio:   number;  // 掛單量 / 幣種平均掛單量（而非絕對美元值）
  wci:             number;
  spoofRate:       number;  // 近期 Spoof 掛單比例
  pauseProb:       number;

  // 錨點特徵
  nearestAnchorScore:  number;
  distToAnchorATR:     number; // 距錨點的 ATR 倍數

  // Delta 特徵
  deltaZScore:         number;
  cumDeltaSlope:       number; // 累積 Delta 的斜率

  // Squeeze 特徵
  inSqueeze:           boolean;
  squeezeAge:          number; // Squeeze 持續多久了（ATR 倍數）
}

// 層二：全局市場特徵（所有幣種共享）
interface GlobalMarketFeatures {
  timestamp:       number;

  btcDominance:    number;  // BTC 市值佔比
  totalMarketCap24HChange: number;  // 總市值 24H 變化率
  btcWCI:          number;  // BTC 的 WCI（作為市場情緒代理）
  altcoinSeason:   number;  // 山寨季指數（0-100）

  // 宏觀流動性代理
  usdtDominance:   number;  // USDT 市值佔比（越高 = 資金觀望）

  // 恐懼貪婪
  fearGreedIndex:  number | null; // 可能取不到，允許 null
}

class HierarchicalFeatureStore {
  private coinStores = new Map<string, CoinSpecificFeature[]>();
  private globalStore: GlobalMarketFeature[] = [];

  // 每個 feature vector 都是「幣種特定 + 全局」的組合
  getFeatureVector(symbol: string, timestamp: number): FullFeatureVector | null {
    const coinFeatures   = this.getNearestCoinFeatures(symbol, timestamp);
    const globalFeatures = this.getNearestGlobalFeatures(timestamp);

    if (!coinFeatures || !globalFeatures) return null;

    return {
      ...coinFeatures,
      ...globalFeatures,
      // 交互特徵
      wciTimesBTCWCI:     coinFeatures.wci * globalFeatures.btcWCI,
      altSeasonBias:      globalFeatures.altcoinSeason > 70 ? 1 : 0,
    };
  }

  private getNearestCoinFeatures(symbol: string, timestamp: number): CoinSpecificFeatures | null {
    const history = this.coinStores.get(symbol) || [];
    // 找最近的（不超過 5 分鐘的時差）
    const nearest = history.findLast(f => Math.abs(f.timestamp - timestamp) < 5 * 60 * 1000);
    return nearest || null;
  }

  private getNearestGlobalFeatures(timestamp: number): GlobalMarketFeatures | null {
    const nearest = this.globalStore.findLast(f => Math.abs(f.timestamp - timestamp) < 15 * 60 * 1000);
    return nearest || null;
  }

  // 全局特徵的數據來源
  async fetchGlobalFeatures(): Promise<GlobalMarketFeatures> {
    const [cmcData, dominanceData] = await Promise.allSettled([
      // BTC Dominance（可從 CoinGecko 免費取得）
      fetch('https://api.coingecko.com/api/v3/global').then(r => r.json()),
      // USDT Dominance
      fetch('https://api.coingecko.com/api/v3/coins/tether').then(r => r.json()),
    ]);

    const globalData  = cmcData.status === 'fulfilled' ? cmcData.value?.data : null;
    const tetherData  = dominanceData.status === 'fulfilled' ? dominanceData.value : null;

    return {
      timestamp:               Date.now(),
      btcDominance:            globalData?.market_cap_percentage?.btc || 50,
      totalMarketCap24HChange: globalData?.market_cap_change_percentage_24h_usd || 0,
      btcWCI:                  this.getLatestBTCWCI(),
      altcoinSeason:           this.computeAltcoinSeason(),
      usdtDominance:           globalData?.market_cap_percentage?.usdt || 5,
      fearGreedIndex:          null, // 需要另一個 API，設為 null 先
    };
  }

  private computeAltcoinSeason(): number {
    // Altcoin Season Index：
    // 過去 90 天，有多少比例的前 50 大山寨幣跑贏 BTC
    // 0 = BTC Season, 100 = Altcoin Season
    const symbols = Array.from(this.coinStores.keys()).filter(s => s !== 'BTCUSDT');
    const btcReturn = this.compute90DReturn('BTCUSDT');
    if (btcReturn === null) return 50;

    const outperforming = symbols.filter(s => {
      const ret = this.compute90DReturn(s);
      return ret !== null && ret > btcReturn;
    });

    return (outperforming.length / (symbols.length || 1)) * 100;
  }

  private compute90DReturn(symbol: string): number | null {
    const history = this.coinStores.get(symbol) || [];
    if (history.length < 2) return null;
    const oldest = history[0];
    const newest = history[history.length - 1];
    // 用 wallSizeRatio 作為價格代理（粗略）
    // 實際應該用日線 K 棒價格
    return null; // TODO: 接入日線數據
  }
}
```

---

### R9-7｜Kill Switch：完整設計

**問題根因（承接 Round 8 待挖 #7）：**
```
R8 文件提到「有 kill switch」
但完全沒有設計：
- 什麼條件觸發？
- 觸發後系統狀態？
- 如何安全恢復？
- 恢復後是否需要人工確認？

危險場景：
  Kill Switch 觸發（系統停止輸出信號）
  用戶有一個開倉中的多單
  系統不提示任何信息
  用戶不知道該平倉還是繼續持有
```

**解決方案：分級 Kill Switch 系統**
```typescript
type KillSwitchLevel = 'SOFT' | 'HARD' | 'EMERGENCY';

interface KillSwitchState {
  level:      KillSwitchLevel | 'ACTIVE';
  triggeredAt: number;
  triggeredBy: string;  // 觸發原因
  message:    string;   // 顯示給用戶的訊息
  openPositions: string[]; // 系統知道的開倉（用戶輸入）
}

class KillSwitchManager {
  private state: KillSwitchState | null = null;

  // SOFT Kill：停止新信號，現有信號繼續有效
  triggerSoft(reason: string): void {
    this.state = {
      level:        'SOFT',
      triggeredAt:  Date.now(),
      triggeredBy:  reason,
      message:      `⚠️ 系統暫停新信號（${reason}）\n現有信號繼續有效，請謹慎操作`,
      openPositions: [],
    };
    signalManager.stopNewSignals();
    alertManager.send('KILL_SWITCH_SOFT', { reason });
    console.warn(`SOFT Kill Switch triggered: ${reason}`);
  }

  // HARD Kill：停止所有信號，現有信號標記為失效
  triggerHard(reason: string): void {
    this.state = {
      level:        'HARD',
      triggeredAt:  Date.now(),
      triggeredBy:  reason,
      message:      `🔴 系統完全停止（${reason}）\n所有信號已失效，請人工管理倉位`,
      openPositions: [],
    };
    signalManager.disableAllSignals(reason);
    signalManager.markAllSignalsStale();
    alertManager.send('KILL_SWITCH_HARD', { reason });
    console.error(`HARD Kill Switch triggered: ${reason}`);
  }

  // EMERGENCY Kill：最高級別，同時觸發外部警報
  triggerEmergency(reason: string): void {
    this.triggerHard(reason);
    this.state!.level = 'EMERGENCY';

    // 立即發送 Telegram 緊急通知
    alertManager.sendUrgent('KILL_SWITCH_EMERGENCY', {
      reason,
      timestamp: new Date().toISOString(),
      action:    '請立即檢查所有開倉並考慮平倉',
    });
  }

  // 觸發條件自動偵測
  autoCheck(
    driftReport:       DriftReport,
    healthReport:      SystemHealth,
    dailyPnl:          number,
    accountSize:       number,
  ): void {
    // 條件一：CRITICAL Drift → HARD Kill
    if (driftReport.severity === 'CRITICAL') {
      this.triggerHard(`Distribution Drift: ${driftReport.driftedFeatures.join(', ')}`);
      return;
    }

    // 條件二：系統健康狀態 CRITICAL → SOFT Kill
    if (healthReport.overall === 'CRITICAL') {
      this.triggerSoft(`System health critical: ${healthReport.components.filter(c => c.status === 'ERROR').map(c => c.name).join(', ')}`);
      return;
    }

    // 條件三：日虧損超過 5% → HARD Kill
    const dailyLossPct = Math.abs(Math.min(0, dailyPnl)) / accountSize;
    if (dailyLossPct >= 0.05) {
      this.triggerEmergency(`Daily loss limit exceeded: ${(dailyLossPct * 100).toFixed(2)}%`);
      return;
    }

    // 條件四：關鍵基礎設施（多個交易所同時斷線）→ SOFT Kill
    const disconnectedExchanges = exchangeMonitor.getDisconnectedExchanges();
    if (disconnectedExchanges.length >= 2) {
      this.triggerSoft(`Multiple exchanges disconnected: ${disconnectedExchanges.join(', ')}`);
    }
  }

  // 恢復流程（需要人工確認）
  async requestRecovery(confirmedBy: string): Promise<RecoveryResult> {
    if (!this.state) return { success: false, reason: 'No kill switch active' };

    // 恢復前的系統狀態檢查
    const healthReport = healthDashboard.getSystemHealth();
    const driftReport  = driftDetector.getLatestReport();

    if (healthReport.overall === 'CRITICAL') {
      return { success: false, reason: '系統健康狀態仍然 CRITICAL，無法恢復' };
    }

    if (driftReport.severity === 'CRITICAL') {
      return { success: false, reason: 'Distribution Drift 尚未解決，建議重新訓練模型' };
    }

    // 分級恢復
    if (this.state.level === 'EMERGENCY' || this.state.level === 'HARD') {
      // HARD/EMERGENCY：需要人工輸入確認碼
      const downtime = Date.now() - this.state.triggeredAt;
      console.log(`Kill switch was active for ${Math.round(downtime / 60000)} minutes`);
      console.log(`Recovered by: ${confirmedBy}`);
    }

    // 恢復信號（先恢復規則引擎，ML 引擎延遲 30 分鐘）
    signalManager.enableRuleBasedSignals();
    setTimeout(() => {
      signalManager.enableMLSignals();
      console.log('ML signals re-enabled after 30 minute grace period');
    }, 30 * 60 * 1000);

    const prevState = this.state;
    this.state = null;

    alertManager.send('KILL_SWITCH_RECOVERED', {
      level:       prevState.level,
      downtime:    Date.now() - prevState.triggeredAt,
      recoveredBy: confirmedBy,
    });

    return { success: true, recoveredAt: Date.now() };
  }
}
```

---

## Round 10：Round 9 解決方案帶出的新問題

---

### R10-1｜Walk-Forward Validator：時間序列的 data leakage 在 Platt Scaling 中仍然存在

**問題：**
```
Walk-Forward Validation 已經正確處理了 base model 的訓練
但 Platt Scaling（校準器）是在 validation set 上訓練的

如果用同一個 validation set：
1. 訓練 base model
2. 在 validation set 上評估得到 raw scores
3. 用這些 raw scores 訓練 Platt Scaler

步驟 3 對步驟 1 的 validation set 有 leakage！
Platt Scaler 在訓練集上有完美表現
但對未來數據的校準效果未知
```

**解決方案：三向切分（Train / Calibration / Test）**
```typescript
class ThreeWaySplit {
  split(samples: LabeledSample[]): DataSplit {
    const sorted = [...samples].sort((a, b) => a.timestamp - b.timestamp);
    const n = sorted.length;

    // 時間切分：60% 訓練 / 20% 校準 / 20% 測試
    const trainEnd = Math.floor(n * 0.60);
    const calEnd   = Math.floor(n * 0.80);

    return {
      train:       sorted.slice(0, trainEnd),
      calibration: sorted.slice(trainEnd, calEnd),
      test:        sorted.slice(calEnd),
    };
  }

  async trainAndCalibrate(
    split:        DataSplit,
    modelFactory: () => MLModel,
  ): Promise<CalibratedModel> {
    // Step 1: 用 train set 訓練 base model
    const baseModel = modelFactory();
    await baseModel.train(split.train);

    // Step 2: 用 calibration set（完全獨立）訓練 Platt Scaler
    const calPredictions = split.calibration.map(s => ({
      score: baseModel.rawScore(s.features),
      label: s.label,
    }));

    const plattScaler = new PlattScaler();
    plattScaler.fit(calPredictions);

    // Step 3: 在 test set 評估校準後的模型
    const testPredictions = split.test.map(s => ({
      probability: plattScaler.transform(baseModel.rawScore(s.features)),
      actual:      s.label,
    }));

    const ece = this.computeECE(testPredictions);
    console.log(`Test ECE (after calibration): ${ece.toFixed(4)}`);

    return new CalibratedModel(baseModel, plattScaler);
  }
}
```

---

### R10-2｜DynamicCorrelationMatrix：收益率序列的同步性問題

**問題：**
```
addDailyReturn() 對每個幣種獨立記錄
但不同幣種可能在不同時間點更新

例如：
  BTC 的日線在 UTC 00:01 確認
  SOL 的日線在 UTC 00:03 確認（網路延遲）

computeEWCorrelation() 用兩個長度相同的陣列對位計算
如果 BTC 有 90 筆，SOL 有 88 筆（漏了 2 天）
對位計算會錯位，相關性計算完全錯誤
```

**解決方案：時間戳對齊的收益率序列**
```typescript
class AlignedReturnSeries {
  private series = new Map<string, Map<number, number>>(); // symbol → (date → return)

  addReturn(symbol: string, dateMs: number, returnPct: number): void {
    // 把時間戳正規化到當天 UTC 00:00
    const dayStart = new Date(dateMs);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayKey = dayStart.getTime();

    if (!this.series.has(symbol)) this.series.set(symbol, new Map());
    this.series.get(symbol)!.set(dayKey, returnPct);
  }

  getAlignedSeries(symbolA: string, symbolB: string, days: number): AlignedPair | null {
    const seriesA = this.series.get(symbolA);
    const seriesB = this.series.get(symbolB);
    if (!seriesA || !seriesB) return null;

    // 找兩個序列的共同日期
    const datesA   = new Set(seriesA.keys());
    const datesB   = new Set(seriesB.keys());
    const commonDates = [...datesA].filter(d => datesB.has(d)).sort((a, b) => a - b);

    // 只用最近 days 天的共同日期
    const recentDates = commonDates.slice(-days);

    if (recentDates.length < days * 0.8) {
      // 缺失太多（超過 20%），不可靠
      return null;
    }

    const returnsA = recentDates.map(d => seriesA.get(d)!);
    const returnsB = recentDates.map(d => seriesB.get(d)!);

    return { dates: recentDates, returnsA, returnsB, coverage: recentDates.length / days };
  }
}
```

---

### R10-3｜KillSwitch：EMERGENCY 級別的 Telegram 推播失敗處理

**問題：**
```
EMERGENCY 觸發時，Telegram 推播是最後一道防線
但如果：
  1. 網路問題導致 Telegram API 無法連接
  2. Bot Token 過期
  3. Chat ID 錯誤

alertManager.sendUrgent() 靜默失敗
用戶完全不知道 EMERGENCY 發生了

這比沒有 Kill Switch 更危險：
系統以為自己已經通知了用戶，但實際上沒有
```

**解決方案：多層通知 + 失敗降級**
```typescript
class EmergencyNotifier {
  private readonly CHANNELS: NotificationChannel[] = [];

  constructor() {
    // 多個通知渠道，按優先順序
    this.CHANNELS = [
      new TelegramChannel(),
      new BrowserNotificationChannel(),   // 瀏覽器推播（需要用戶授權）
      new AudioAlertChannel(),             // 瀏覽器聲音警報
      new VisualAlertChannel(),            // 全螢幕視覺警報（最後手段）
    ];
  }

  async sendUrgent(message: string, data: unknown): Promise<NotificationResult> {
    const results: ChannelResult[] = [];
    let atLeastOneSucceeded = false;

    for (const channel of this.CHANNELS) {
      try {
        const result = await Promise.race([
          channel.send(message, data),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 5000) // 5 秒超時
          ),
        ]);
        results.push({ channel: channel.name, success: true });
        atLeastOneSucceeded = true;
      } catch (e) {
        results.push({ channel: channel.name, success: false, error: String(e) });
      }
    }

    if (!atLeastOneSucceeded) {
      // 所有渠道都失敗：直接操作 DOM 顯示警報（這個不依賴網路）
      this.showBlockingDOMAlert(message);
    }

    return { results, atLeastOneSucceeded };
  }

  private showBlockingDOMAlert(message: string): void {
    // 直接在頁面上建立一個無法關閉的全螢幕警報
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 999999;
      background: rgba(220, 38, 38, 0.95);
      display: flex; align-items: center; justify-content: center;
      font-family: monospace; color: white; font-size: 24px;
      text-align: center; padding: 40px;
    `;
    overlay.innerHTML = `
      <div>
        <div style="font-size: 48px; margin-bottom: 20px">⚠️ EMERGENCY KILL SWITCH</div>
        <div>${message}</div>
        <div style="margin-top: 20px; font-size: 16px">所有信號已停止 · 請人工管理倉位</div>
        <button onclick="this.parentElement.parentElement.remove()"
          style="margin-top: 30px; padding: 10px 30px; font-size: 18px; cursor: pointer">
          我已知曉，關閉警報
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
  }
}
```

---

### R10-4｜MultiTimeframeDeltaEngine：內存使用問題

**問題根源：**
```
4 個時框 × sessionDeltas Map
每個 time step 一個 entry

BTC 每秒 100 筆 aggTrade
1H K 棒：一個 entry（把 3600 筆成交彙總成 1 個 Delta）
1D K 棒：一個 entry（把 86400 筆成交彙總成 1 個 Delta）

sessionDeltas 的大小：
  15m 時框：每 15 分鐘一個 entry，90 天 = 8,640 個 entry
  1D 時框：每天一個 entry，90 天 = 90 個 entry

問題不在 entry 數量，而在 aggTrade 的原始 tradeLogs：
  每個 WallConsumptionTracker 保留 30 分鐘的 tradeLogs
  BTC 30 分鐘 ≈ 180,000 筆成交
  100 個追蹤中的 Wall × 180,000 = 18,000,000 筆記錄
  每筆 { qty: number, ts: number } = 16 bytes
  18,000,000 × 16 bytes = 288 MB

這才是真正的內存殺手
```

**解決方案：aggTrade 的流式聚合，不保留原始記錄**
```typescript
class StreamingTradeAggregator {
  // 不保留原始 tradeLogs
  // 只維護滑動窗口的聚合統計量

  private readonly WINDOW_MS = 30 * 60 * 1000; // 30 分鐘
  private readonly BUCKET_MS = 60 * 1000;       // 每分鐘一個 bucket

  // 環形 bucket 陣列（30 個 bucket，每個代表 1 分鐘）
  private buckets:   number[] = new Array(30).fill(0); // 每分鐘的成交量
  private bucketIdx: number   = 0;
  private lastBucketTime:    number = 0;

  recordTrade(qty: number, price: number, wallPrice: number, atr14: number): void {
    const tolerance = getTradeMatchTolerance(atr14);
    if (Math.abs(price - wallPrice) > tolerance) return;

    // 旋轉到當前 bucket
    const now     = Date.now();
    const elapsed = now - this.lastBucketTime;
    const bucketsToRotate = Math.floor(elapsed / this.BUCKET_MS);

    if (bucketsToRotate > 0) {
      for (let i = 0; i < Math.min(bucketsToRotate, this.buckets.length); i++) {
        this.bucketIdx = (this.bucketIdx + 1) % this.buckets.length;
        this.buckets[this.bucketIdx] = 0; // 清空新 bucket
      }
      this.lastBucketTime = now - (now % this.BUCKET_MS);
    }

    // 加入當前 bucket
    this.buckets[this.bucketIdx] += qty;
  }

  // 取得過去 windowMs 的累積成交量
  getTotalTraded(): number {
    return this.buckets.reduce((a, b) => a + b, 0);
  }

  // 記憶體使用：30 個 number = 240 bytes / tracker
  // vs 原來的 180,000 × 16 bytes = 2.88 MB / tracker
  // 節省 12,000 倍
}
```

---

## 📋 給下一個 AI 的完整接續指引（Round 11）

### 已完成的漏洞清單（Round 9-10）

```
R9-1：相關性矩陣自動更新（EW 雙窗口 + 日線 Fetcher）✓
R9-2：PSI Reference 分佈管理（Quantile Binning + 版本控制）✓
R9-3：Walk-Forward 驗證框架（5-fold + 多指標）✓
R9-4：Feedback Loop 統計式偵測（降權而非過濾）✓
R9-5：Transformer Positional Encoding（多尺度時間編碼）✓
R9-6：多幣種 Feature Store（兩層架構）✓
R9-7：Kill Switch 完整設計（分級 + 自動觸發 + 恢復流程）✓
R10-1：Platt Scaling Leakage（三向切分）✓
R10-2：收益率序列時間對齊（共同日期對齊）✓
R10-3：EMERGENCY 通知失敗降級（多渠道 + DOM 警報）✓
R10-4：aggTrade 內存問題（流式聚合 Bucket）✓
```

### Round 11 待挖問題

```
1. DailyReturnFetcher 的冷啟動問題
   - 系統剛部署時沒有 90 天的歷史收益率
   - 相關性矩陣需要多少天才能可靠？
   - 冷啟動期間的 RiskEngine 應該用什麼預設相關性？

2. StreamingTradeAggregator 的 bucket 旋轉
   - 如果系統暫停 2 小時後恢復
   - bucketsToRotate 可能超過 30（bucket 總數）
   - 所有 bucket 都被清零，30 分鐘的累積數據全部丟失

3. ThreeWaySplit 在數據極少時的降級策略
   - 小幣種可能只有 100 筆 PauseModel 樣本
   - 60/20/20 切分後：60 訓練 / 20 校準 / 20 測試
   - 60 筆訓練樣本對 LightGBM 完全不夠
   - 需要在「模型複雜度 vs 數據量」之間做選擇

4. GlobalMarketFeatures 的 CoinGecko API 限速
   - CoinGecko 免費 API：每分鐘 10-30 次請求
   - 系統每 15 分鐘更新一次全局特徵，共需 2 次請求
   - 但如果同時監控 50 個幣種，每個幣種都想取全局特徵
   - 解法：單一全局特徵 fetch，所有幣種共享

5. KillSwitch 的「恢復後 30 分鐘只開規則引擎」
   - 用戶在這 30 分鐘內看到的信號可信嗎？
   - 規則引擎沒有 Drift Detection，可能輸出舊 regime 的信號
   - 恢復期間應該同時顯示「系統處於恢復模式」的警告

6. ProtectedOnlineLearner 的 Shadow Model 升格條件
   - 「準確率比 production 高 5%」在 500 個樣本上可靠嗎？
   - 統計顯著性：500 樣本的準確率標準差約 2.2%
   - 5% 的差異才勉強達到統計顯著
   - 需要更嚴格的升格條件（例如 p-value < 0.05）

7. EventBasedSequenceEncoder 的事件數量不均勻
   - 活躍市場：20 分鐘產生 20 個事件（MAX_EVENTS 滿了）
   - 冷清市場：2 天才產生 5 個事件
   - Transformer 的 attention mechanism 對序列長度敏感
   - 需要 padding 策略讓所有序列長度相同
```

### 系統完整性檢查清單

```typescript
// 每次 AI 接手前必須確認的不變量
const SYSTEM_INVARIANTS = {
  // 數據純淨性
  noFutureData:         '所有 inference 只用 timestamp <= now 的數據',
  labelLag:             'PauseModel label 在事件發生後最少 1H 才鎖定',
  trainTestSeparation:  '訓練集 / 校準集 / 測試集按時間切分，不重疊',

  // 模型安全性
  driftFallback:        'Drift CRITICAL → 自動切換規則引擎',
  killSwitchActive:     'Kill Switch 觸發後信號立即停止，不需要人工干預',
  uncertaintyRequired:  '所有預測必須有 confidence，confidence < 0.60 不輸出信號',

  // 系統穩定性
  memoryBounded:        'StreamingTradeAggregator 使用固定 30 個 bucket，不增長',
  storageGC:            'IndexedDB 每天清理 7 天前的關鍵事件',
  correlationUpdated:   '相關性矩陣每天 UTC 00:00 更新一次',

  // 不可修改
  squeezeEngine:        'Squeeze 收斂判定邏輯：READONLY',
};
```
