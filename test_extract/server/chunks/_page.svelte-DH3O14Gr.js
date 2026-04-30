import { o as onDestroy } from './index-server-E2pZ9arA.js';
import { h as head, V as ensure_array_like, e as escape_html, W as attr, X as attr_class, Y as attr_style, Z as stringify, P as derived } from './dev-BZuC-LR5.js';
import 'lightweight-charts';

//#region src/lib/components/SearchBar.svelte
function SearchBar($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		$$renderer.push(`<div class="search-wrapper svelte-yyldap" id="search-bar"><div class="search-icon svelte-yyldap"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg></div> <input type="text"${attr("value", "")} placeholder="搜尋幣種... 例如 Bitcoin, ETH, SOL" class="search-input svelte-yyldap" id="search-input"/> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div>`);
	});
}
//#endregion
//#region src/lib/components/NewsPanel.svelte
function NewsPanel($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		$$renderer.push(`<div class="news-panel svelte-1lpagsb" id="news-panel"><h3 class="panel-title svelte-1lpagsb"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svelte-1lpagsb"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" class="svelte-1lpagsb"></path><path d="M18 14h-8" class="svelte-1lpagsb"></path><path d="M15 18h-5" class="svelte-1lpagsb"></path><path d="M10 6h8v4h-8V6Z" class="svelte-1lpagsb"></path></svg> 最新新聞</h3> `);
		{
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="loading-state svelte-1lpagsb"><!--[-->`);
			const each_array = ensure_array_like([
				1,
				2,
				3,
				4,
				5
			]);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				each_array[$$index];
				$$renderer.push(`<div class="skeleton-card svelte-1lpagsb"><div class="skeleton-line wide svelte-1lpagsb"></div> <div class="skeleton-line narrow svelte-1lpagsb"></div></div>`);
			}
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]--></div>`);
	});
}
//#endregion
//#region src/lib/components/KlineChart.svelte
function KlineChart($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { symbol = "BTCUSDT", coinName = "Bitcoin"} = $$props;
		let chart = null;
		let activeInterval = "4h";
		let showEma = true;
		let showSqueeze = true;
		let showPoc = true;
		const intervals = [
			{
				label: "1H",
				value: "1h"
			},
			{
				label: "4H",
				value: "4h"
			},
			{
				label: "1D",
				value: "1d"
			},
			{
				label: "1W",
				value: "1w"
			}
		];
		onDestroy(() => {
			chart?.remove();
			chart = null;
		});
		$$renderer.push(`<div class="kline-wrapper svelte-4851mn" id="kline-chart"><div class="kline-header svelte-4851mn"><div class="kline-title svelte-4851mn"><h3 class="svelte-4851mn">${escape_html(coinName)}</h3> <span class="kline-symbol svelte-4851mn">${escape_html(symbol)}</span></div> <div class="header-controls svelte-4851mn"><div class="indicator-toggles svelte-4851mn"><button${attr_class("ind-btn svelte-4851mn", void 0, { "active": showEma })} title="EMA 21/55/100/200"><span class="ind-dot svelte-4851mn" style="background: #ffeb3b"></span> EMA</button> <button${attr_class("ind-btn svelte-4851mn", void 0, { "active": showSqueeze })} title="波動預警 (BB-KC Squeeze)"><span class="ind-dot svelte-4851mn" style="background: #ff9800"></span> SQZ</button> <button${attr_class("ind-btn svelte-4851mn", void 0, { "active": showPoc })} title="實體 POC 區域"><span class="ind-dot svelte-4851mn" style="background: rgba(0, 230, 118, 0.8)"></span> POC</button></div> <div class="interval-tabs svelte-4851mn"><!--[-->`);
		const each_array = ensure_array_like(intervals);
		for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
			let { label, value } = each_array[$$index];
			$$renderer.push(`<button${attr_class("interval-btn svelte-4851mn", void 0, { "active": activeInterval === value })}>${escape_html(label)}</button>`);
		}
		$$renderer.push(`<!--]--></div></div></div> `);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<div class="ema-legend svelte-4851mn"><span class="ema-tag svelte-4851mn" style="color: #ffeb3b">EMA21</span> <span class="ema-tag svelte-4851mn" style="color: #ff9800">EMA55</span> <span class="ema-tag svelte-4851mn" style="color: #2196f3">EMA100</span> <span class="ema-tag svelte-4851mn" style="color: #e040fb">EMA200</span> `);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<span class="ema-tag squeeze-tag svelte-4851mn"><span class="sq-dot on svelte-4851mn"></span> 擠壓中 <span class="sq-dot off svelte-4851mn"></span> 正常</span>`);
		$$renderer.push(`<!--]--></div>`);
		$$renderer.push(`<!--]--> <div class="chart-area svelte-4851mn">`);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<div class="chart-loading svelte-4851mn"><div class="chart-spinner svelte-4851mn"></div> <span>載入圖表中...</span></div>`);
		$$renderer.push(`<!--]--> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div></div>`);
	});
}
//#endregion
//#region src/lib/components/RankingCard.svelte
function RankingCard($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { title = "排行榜", icon = "📊", type = "hot", onSelectCoin } = $$props;
		$$renderer.push(`<div class="ranking-card svelte-1faq9r0"${attr("id", `ranking-${stringify(type)}`)}><h3 class="card-title svelte-1faq9r0"><span class="card-icon svelte-1faq9r0">${escape_html(icon)}</span> ${escape_html(title)}</h3> `);
		{
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="loading-items svelte-1faq9r0"><!--[-->`);
			const each_array = ensure_array_like([
				1,
				2,
				3,
				4,
				5
			]);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				each_array[$$index];
				$$renderer.push(`<div class="skeleton-row svelte-1faq9r0"></div>`);
			}
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]--></div>`);
	});
}
//#endregion
//#region src/lib/components/SqueezeAlert.svelte
function SqueezeAlert($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let activeTab = "4h";
		$$renderer.push(`<div class="squeeze-panel svelte-1ukc8t6" id="squeeze-alert"><h3 class="panel-title svelte-1ukc8t6"><span class="pulse-dot svelte-1ukc8t6"></span> 波動預警</h3> <div class="tab-row svelte-1ukc8t6"><button${attr_class("tab-btn svelte-1ukc8t6", void 0, { "active": activeTab === "1h" })}>1H</button> <button${attr_class("tab-btn svelte-1ukc8t6", void 0, { "active": activeTab === "4h" })}>4H</button> <button${attr_class("tab-btn svelte-1ukc8t6", void 0, { "active": activeTab === "1d" })}>1D</button></div> `);
		{
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="loading-items svelte-1ukc8t6"><!--[-->`);
			const each_array = ensure_array_like([
				1,
				2,
				3
			]);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				each_array[$$index];
				$$renderer.push(`<div class="skeleton-row svelte-1ukc8t6"></div>`);
			}
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]--></div>`);
	});
}
//#endregion
//#region src/lib/components/SectorHeatmap.svelte
function SectorHeatmap($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let sortBy = "change";
		let globalWhales = {};
		if (typeof window !== "undefined") document.addEventListener("whale_update", (e) => {
			globalWhales[e.detail.symbol] = e.detail.zones;
		});
		$$renderer.push(`<div class="sector-heatmap svelte-ya9t6e" id="sector-heatmap"><div class="heatmap-header svelte-ya9t6e"><h3 class="heatmap-title svelte-ya9t6e"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svelte-ya9t6e"><rect x="3" y="3" width="7" height="7" rx="1" class="svelte-ya9t6e"></rect><rect x="14" y="3" width="7" height="7" rx="1" class="svelte-ya9t6e"></rect><rect x="3" y="14" width="7" height="7" rx="1" class="svelte-ya9t6e"></rect><rect x="14" y="14" width="7" height="7" rx="1" class="svelte-ya9t6e"></rect></svg> 熱門板塊漲幅比較</h3> <div class="sort-btns svelte-ya9t6e"><button${attr_class("sort-btn svelte-ya9t6e", void 0, { "active": sortBy === "change" })}>漲幅</button> <button${attr_class("sort-btn svelte-ya9t6e", void 0, { "active": sortBy === "market_cap" })}>市值</button> <button${attr_class("sort-btn svelte-ya9t6e", void 0, { "active": sortBy === "volume" })}>交易量</button></div></div> `);
		{
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="loading-grid svelte-ya9t6e"><!--[-->`);
			const each_array = ensure_array_like(Array(12));
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				each_array[$$index];
				$$renderer.push(`<div class="skeleton-block svelte-ya9t6e"></div>`);
			}
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]--></div>`);
	});
}
var LatencyMonitor = class {
	latencies = {};
	isAnomalous = false;
	recoveryStartTime = null;
	ANOMALY_THRESHOLD_MS = 3e3;
	RECOVERY_THRESHOLD_MS = 1e3;
	RECOVERY_DURATION_MS = 6e4;
	record(exchange, latencyMs) {
		if (latencyMs < 0 || latencyMs > 1e4) return;
		if (!this.latencies[exchange]) this.latencies[exchange] = [];
		this.latencies[exchange].push(latencyMs);
		if (this.latencies[exchange].length > 100) this.latencies[exchange].shift();
	}
	getP95(exchange) {
		const arr = [...this.latencies[exchange] || []].sort((a, b) => a - b);
		if (arr.length === 0) return 0;
		return arr[Math.floor(arr.length * .95)];
	}
	/** Returns entity match window in ms; 0 = anomalous, skip cross-exchange matching */
	getMatchWindow() {
		const maxP95 = Math.max(this.getP95("binance"), this.getP95("bybit"), this.getP95("okx"), 100);
		if (!this.isAnomalous) {
			if (maxP95 > this.ANOMALY_THRESHOLD_MS) {
				this.isAnomalous = true;
				this.recoveryStartTime = null;
			}
			return Math.min(3e3, maxP95 + 500);
		}
		if (maxP95 <= this.RECOVERY_THRESHOLD_MS) {
			if (!this.recoveryStartTime) this.recoveryStartTime = Date.now();
			else if (Date.now() - this.recoveryStartTime >= this.RECOVERY_DURATION_MS) {
				this.isAnomalous = false;
				this.recoveryStartTime = null;
			}
		} else this.recoveryStartTime = null;
		return this.isAnomalous ? 0 : Math.min(3e3, maxP95 + 500);
	}
	get anomalyActive() {
		return this.isAnomalous;
	}
};
var latencyMonitor = new LatencyMonitor();
var IcebergDetector = class {
	wallHistory = /* @__PURE__ */ new Map();
	wallLifecycles = /* @__PURE__ */ new Map();
	MAX_GAP_MS = 3e4;
	DECAY_AFTER_MS = 1440 * 60 * 1e3;
	disconnectTimes = /* @__PURE__ */ new Map();
	onExchangeDisconnect(exchange) {
		this.disconnectTimes.set(exchange, Date.now());
	}
	onExchangeReconnect(exchange) {}
	/** R4-2-A: key includes symbol+side to prevent cross-symbol collisions */
	normalizeKey(side, price, symbol, exchange) {
		const grid = price > 1e4 ? 50 : price > 1e3 ? 5 : price > 100 ? .5 : .05;
		return `${symbol}_${exchange}_${side}_${Math.round(price / grid) * grid}`;
	}
	/** R4-2-B: returns decay-adjusted refill count */
	getRefillCount(side, price, symbol, exchange) {
		const key = this.normalizeKey(side, price, symbol, exchange);
		const record = this.wallHistory.get(key);
		if (!record) return 0;
		const age = Date.now() - record.lastRefillTime;
		if (age > this.DECAY_AFTER_MS) {
			this.wallHistory.delete(key);
			return 0;
		}
		if (age > 6 * 36e5) {
			const decay = 1 - (age - 6 * 36e5) / (18 * 36e5);
			return Math.floor(record.count * decay);
		}
		return record.count;
	}
	/** Called when a wall appears; detects refill and increments count. Returns new refill count. */
	onWallAppear(side, price, qty, symbol, exchange) {
		const key = this.normalizeKey(side, price, symbol, exchange);
		const lc = this.wallLifecycles.get(key);
		if (lc) {
			const disconnectDuration = this.disconnectTimes.get(exchange) ? Date.now() - (this.disconnectTimes.get(exchange) ?? 0) : 0;
			const effectiveMaxGap = disconnectDuration > 0 ? Math.max(this.MAX_GAP_MS, disconnectDuration + 6e4) : this.MAX_GAP_MS;
			if (Date.now() - lc.lastDisappearTime <= effectiveMaxGap) {
				const record = this.wallHistory.get(key) || {
					count: 0,
					lastRefillTime: 0
				};
				record.count++;
				record.lastRefillTime = Date.now();
				this.wallHistory.set(key, record);
			}
		}
		this.wallLifecycles.delete(key);
		return this.getRefillCount(side, price, symbol, exchange);
	}
	/** Called when a wall disappears */
	onWallDisappear(side, price, qty, symbol, exchange) {
		const key = this.normalizeKey(side, price, symbol, exchange);
		this.wallLifecycles.set(key, {
			lastDisappearTime: Date.now(),
			lastQty: qty,
			exchange
		});
	}
};
var icebergDetector = new IcebergDetector();
var LiquidityEngine = class {
	entityPools = /* @__PURE__ */ new Map();
	tradeBuffer = [];
	priceHist = {};
	lastUpdateMsMap = /* @__PURE__ */ new Map();
	lastUpdateMs = 0;
	lastSnapshotTime = 0;
	prevDepthSnapshots = /* @__PURE__ */ new Map();
	wciFlows = {};
	channel = null;
	DB_NAME = "TradingMonitorDB";
	STORE_NAME = "snapshots";
	constructor() {
		if (typeof window !== "undefined") {
			this.initDB().then(() => this.loadLatestSnapshot());
			this.channel = new BroadcastChannel("whale-monitor-sync");
			this.channel.onmessage = (ev) => {
				if (ev.data.type === "snapshot-saved") this.loadLatestSnapshot();
			};
			setInterval(() => this.saveSnapshot(), 6e4);
			setInterval(() => this.cleanTradeBuffer(), 1e4);
		}
	}
	async initDB() {
		return new Promise((resolve, reject) => {
			const req = indexedDB.open(this.DB_NAME, 1);
			req.onupgradeneeded = (e) => {
				if (!e.target.result.objectStoreNames.contains(this.STORE_NAME)) e.target.result.createObjectStore(this.STORE_NAME, { keyPath: "timestamp" });
			};
			req.onsuccess = () => resolve(true);
			req.onerror = (e) => reject(e);
		});
	}
	async loadLatestSnapshot() {
		const req = indexedDB.open(this.DB_NAME, 1);
		req.onsuccess = (e) => {
			const cursorReq = e.target.result.transaction(this.STORE_NAME, "readonly").objectStore(this.STORE_NAME).openCursor(null, "prev");
			cursorReq.onsuccess = (ev) => {
				const cursor = ev.target.result;
				if (cursor) {
					const data = cursor.value.delta;
					this.entityPools.clear();
					data.forEach((d) => {
						const entity = {
							id: d.id,
							exchange: d.ex,
							symbol: d.sym,
							side: d.s,
							prices: [d.p],
							avgPrice: d.p,
							totalUsd: d.usd,
							prevUsd: d.usd,
							firstSeenMs: d.fs,
							lastSeenMs: d.ls,
							createdAtMs: d.fs,
							disappearedCount: d.dc || 0,
							lifetimeTotalMs: d.lt || 0,
							minPriceObjObserved: d.p,
							maxPriceObjObserved: d.p,
							reactionScore: d.scores.r || 50,
							initiativeScore: d.scores.i || 50,
							spoofScore: d.scores.s || 0,
							decayScore: d.scores.d || 0,
							refillCount: icebergDetector.getRefillCount(d.s, d.p, d.sym, d.ex)
						};
						this.getPool(d.ex).set(d.id, entity);
					});
				}
			};
		};
	}
	getPool(ex) {
		if (!this.entityPools.has(ex)) this.entityPools.set(ex, /* @__PURE__ */ new Map());
		return this.entityPools.get(ex);
	}
	async saveSnapshot() {
		const now = Date.now();
		const activeEntities = this.getAllEntities().filter((e) => now - e.lastSeenMs < 1e4);
		if (activeEntities.length > 0) {
			const compressed = activeEntities.map((e) => ({
				id: e.id,
				ex: e.exchange,
				sym: e.symbol,
				s: e.side,
				p: e.avgPrice,
				usd: e.totalUsd,
				fs: e.firstSeenMs,
				ls: e.lastSeenMs,
				dc: e.disappearedCount,
				lt: e.lifetimeTotalMs,
				scores: {
					r: e.reactionScore,
					i: e.initiativeScore,
					s: e.spoofScore,
					d: e.decayScore
				}
			}));
			const req = indexedDB.open(this.DB_NAME, 1);
			req.onsuccess = (e) => {
				const store = e.target.result.transaction(this.STORE_NAME, "readwrite").objectStore(this.STORE_NAME);
				store.add({
					timestamp: now,
					delta: compressed
				});
				const qReq = store.openCursor();
				qReq.onsuccess = (cev) => {
					const cursor = cev.target.result;
					if (cursor) {
						if (now - cursor.value.timestamp > 864e5) cursor.delete();
						cursor.continue();
					}
				};
				if (this.channel) this.channel.postMessage({ type: "snapshot-saved" });
			};
			this.lastSnapshotTime = now;
		}
	}
	getAllEntities() {
		const all = [];
		this.entityPools.forEach((pool) => all.push(...Array.from(pool.values())));
		return all;
	}
	parseTradeUpdate(exchange, symbol, price, usd, timestamp) {
		this.tradeBuffer.push({
			exchange,
			symbol,
			price,
			usd,
			timestamp
		});
	}
	cleanTradeBuffer() {
		const cutoff = Date.now() - 1e4;
		this.tradeBuffer = this.tradeBuffer.filter((t) => t.timestamp > cutoff);
	}
	parseDepthUpdate(exchange, symbol, currentPrice, bids, asks) {
		this.priceHist[symbol] = currentPrice;
		const now = Date.now();
		this.lastUpdateMs = now;
		this.lastUpdateMsMap.set(symbol, now);
		const THRESHOLDS = {
			BTCUSDT: 3e6,
			ETHUSDT: 15e5,
			DEFAULT: 5e5
		};
		const minUsdThreshold = THRESHOLDS[symbol.replace("/", "")] || THRESHOLDS.DEFAULT;
		const processRaw = (list, side) => {
			for (const [pStr, qStr] of list) {
				const price = parseFloat(pStr);
				const usd = price * parseFloat(qStr);
				if (usd < minUsdThreshold) continue;
				this.assignEntity({
					exchange,
					symbol,
					side,
					price,
					usd,
					timestamp: now
				}, currentPrice);
			}
		};
		processRaw(bids, "Buy");
		processRaw(asks, "Sell");
		this.calculateWciFlow(exchange, symbol, bids, asks);
		this.evaluateScores(now, currentPrice, exchange);
	}
	calculateWciFlow(exchange, symbol, bids, asks) {
		const key = `${exchange}_${symbol}`;
		const currentBids = new Map(bids.map(([p, q]) => [parseFloat(p), parseFloat(p) * parseFloat(q)]));
		const currentAsks = new Map(asks.map(([p, q]) => [parseFloat(p), parseFloat(p) * parseFloat(q)]));
		const prevBids = this.prevDepthSnapshots.get(`${key}_Buy`) || /* @__PURE__ */ new Map();
		const prevAsks = this.prevDepthSnapshots.get(`${key}_Sell`) || /* @__PURE__ */ new Map();
		let addedBuy = 0;
		let cancelledBuy = 0;
		let addedSell = 0;
		let cancelledSell = 0;
		for (const [p, usd] of currentBids) {
			const prevUsd = prevBids.get(p) || 0;
			if (usd > prevUsd) addedBuy += usd - prevUsd;
		}
		for (const [p, usd] of prevBids) if (!currentBids.has(p)) cancelledBuy += usd;
		else if (currentBids.get(p) < usd) cancelledBuy += usd - currentBids.get(p);
		for (const [p, usd] of currentAsks) {
			const prevUsd = prevAsks.get(p) || 0;
			if (usd > prevUsd) addedSell += usd - prevUsd;
		}
		for (const [p, usd] of prevAsks) if (!currentAsks.has(p)) cancelledSell += usd;
		else if (currentAsks.get(p) < usd) cancelledSell += usd - currentAsks.get(p);
		const flow = addedBuy - cancelledBuy - (addedSell - cancelledSell);
		const totalActivity = addedBuy + cancelledBuy + addedSell + cancelledSell;
		this.wciFlows[key] = totalActivity > 0 ? flow / totalActivity : 0;
		this.prevDepthSnapshots.set(`${key}_Buy`, currentBids);
		this.prevDepthSnapshots.set(`${key}_Sell`, currentAsks);
	}
	assignEntity(raw, currentPrice) {
		const pool = this.getPool(raw.exchange);
		let matchedEntity = null;
		for (const entity of pool.values()) {
			if (entity.symbol !== raw.symbol || entity.side !== raw.side) continue;
			const priceDiffPct = Math.abs(entity.avgPrice - raw.price) / raw.price;
			const timeDiff = raw.timestamp - entity.lastSeenMs;
			if (priceDiffPct <= .001 && timeDiff <= 2e3) {
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
			matchedEntity.avgPrice = matchedEntity.prices.reduce((a, b) => a + b, 0) / matchedEntity.prices.length;
		} else {
			const newId = `${raw.exchange}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
			const refillCount = icebergDetector.onWallAppear(raw.side, raw.price, raw.usd, raw.symbol, raw.exchange);
			pool.set(newId, {
				id: newId,
				exchange: raw.exchange,
				symbol: raw.symbol,
				side: raw.side,
				prices: [raw.price],
				avgPrice: raw.price,
				totalUsd: raw.usd,
				prevUsd: raw.usd,
				firstSeenMs: raw.timestamp,
				lastSeenMs: raw.timestamp,
				createdAtMs: raw.timestamp,
				disappearedCount: 0,
				lifetimeTotalMs: 0,
				minPriceObjObserved: currentPrice,
				maxPriceObjObserved: currentPrice,
				reactionScore: 50,
				initiativeScore: 50,
				spoofScore: 0,
				decayScore: 0,
				refillCount
			});
		}
	}
	evaluateScores(now, currentPrice, exchange) {
		const pool = this.getPool(exchange);
		const allEntitiesParams = this.getAllEntities();
		for (const [id, entity] of pool.entries()) {
			const ageSec = (now - entity.firstSeenMs) / 1e3;
			const distToPx = Math.abs(currentPrice - entity.avgPrice) / currentPrice;
			if (ageSec > 1800 && distToPx > .015) {
				const decayMinutes = (ageSec - 1800) / 60;
				entity.decayScore = Math.min(100, decayMinutes * 2);
			} else entity.decayScore = 0;
			if (entity.side === "Buy") {
				if ((currentPrice - entity.avgPrice) / entity.avgPrice > .01) entity.initiativeScore = Math.min(100, entity.initiativeScore + 10);
			} else if ((entity.avgPrice - currentPrice) / entity.avgPrice > .01) entity.initiativeScore = Math.min(100, entity.initiativeScore + 10);
			const usdDiff = entity.totalUsd - entity.prevUsd;
			if (distToPx < .001) {
				if (usdDiff < 0) {
					const tradedUsd = this.tradeBuffer.filter((t) => t.symbol === entity.symbol && t.exchange === entity.exchange && Math.abs(t.price - entity.avgPrice) / entity.avgPrice < .001 && t.timestamp > now - 5e3).reduce((sum, t) => sum + t.usd, 0);
					const droppedUsd = Math.abs(usdDiff);
					if (entity.side === "Buy" ? currentPrice >= entity.avgPrice * .999 : currentPrice <= entity.avgPrice * 1.001) if (tradedUsd >= droppedUsd * .8) {
						entity.reactionScore = Math.min(100, entity.reactionScore + 30);
						entity.spoofScore = Math.max(0, entity.spoofScore - 20);
					} else entity.spoofScore = Math.min(100, entity.spoofScore + 10);
					else entity.reactionScore = 0;
				}
			}
			if (allEntitiesParams.filter((p) => p.exchange !== entity.exchange && p.symbol === entity.symbol && p.side === entity.side && Math.abs(p.avgPrice - entity.avgPrice) / entity.avgPrice < .001 && Math.abs(p.firstSeenMs - entity.firstSeenMs) < 2e3).length > 0);
			entity.lifetimeTotalMs += now - entity.lastSeenMs;
			if (now - entity.lastSeenMs > 5e3) entity.disappearedCount++;
			if (ageSec > 3600) {
				if (entity.disappearedCount / (ageSec / 60) > 2) entity.spoofScore = 100;
			}
			if (now - entity.lastSeenMs > 3e4) {
				icebergDetector.onWallDisappear(entity.side, entity.avgPrice, entity.totalUsd, entity.symbol, entity.exchange);
				entity.refillCount = icebergDetector.getRefillCount(entity.side, entity.avgPrice, entity.symbol, entity.exchange);
				pool.delete(id);
			}
		}
	}
	getActiveZones(symbol, currentPrice) {
		const zones = [];
		const now = Date.now();
		const symLastUpdate = this.lastUpdateMsMap.get(symbol) ?? now;
		const allLive = this.getAllEntities().filter((e) => e.symbol === symbol && symLastUpdate - e.lastSeenMs < 15e3);
		const FRESH_WALL_MAX_AGE = 3e4;
		const freshLive = allLive.filter((e) => now - e.lastSeenMs <= FRESH_WALL_MAX_AGE && e.spoofScore < 40);
		const range = currentPrice * .01;
		const nearLiq = freshLive.filter((e) => Math.abs(e.avgPrice - currentPrice) < range).reduce((s, e) => s + e.totalUsd, 0);
		if (freshLive.filter((e) => {
			const d = Math.abs(e.avgPrice - currentPrice);
			return d >= range && d < range * 3;
		}).reduce((s, e) => s + e.totalUsd, 0) > nearLiq * 5 && nearLiq < 1e7) zones.push({
			top: currentPrice + range,
			bottom: currentPrice - range,
			heat: 100,
			type: "Void",
			side: "Buy"
		});
		let buyEntities = allLive.filter((e) => e.side === "Buy").sort((a, b) => b.totalUsd - a.totalUsd);
		let sellEntities = allLive.filter((e) => e.side === "Sell").sort((a, b) => b.totalUsd - a.totalUsd);
		for (const e of [...buyEntities, ...sellEntities]) {
			const ageMs = this.lastUpdateMs - e.firstSeenMs;
			const persistenceState = ageMs >= 18e4 ? "CONFIRMED" : "PENDING";
			if (persistenceState === "PENDING" && e.totalUsd < 5e6) continue;
			const ageSec = ageMs / 1e3;
			let persistence = ageSec > 7200 ? 100 : ageSec > 1800 ? 80 : ageSec > 300 ? 40 : 20;
			const distToPx = Math.abs(currentPrice - e.avgPrice) / currentPrice;
			let distance = distToPx < .002 ? 0 : distToPx < .005 ? 20 : distToPx < .02 ? 80 : 100;
			let rawTrust = e.reactionScore * .15 + e.initiativeScore * .15 + 50 * .15 + 50 * .15 + persistence * .1 + distance * .1 + 50 * .1 + 50 * .1 - e.decayScore * .1;
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
			const matches = latencyMonitor.getMatchWindow() > 0 ? allLive.filter((o) => o.id !== e.id && o.side === e.side && o.exchange !== e.exchange && Math.abs(o.avgPrice - e.avgPrice) / e.avgPrice <= 5e-4) : [];
			const exchanges = new Set(matches.map((o) => o.exchange));
			exchanges.add(e.exchange);
			const confidence = exchanges.size >= 3 ? "HIGH" : exchanges.size === 2 ? "MED" : "LOW";
			const icebergTrustBonus = e.refillCount >= 3 ? Math.min(20, e.refillCount * 5) : 0;
			const finalTrust = Math.min(100, Trust + icebergTrustBonus);
			const finalHeat = Math.min(100, Math.round(finalTrust * .6 + 40));
			zones.push({
				top: Math.max(...e.prices),
				bottom: Math.min(...e.prices),
				heat: isTrap ? Math.min(100, e.spoofScore * 1.5) : finalHeat,
				type: isTrap ? "Trap" : "Wall",
				side: e.side,
				spoofScore: e.spoofScore,
				reactionScore: e.reactionScore,
				firstSeenMs: e.firstSeenMs,
				totalUsd: e.totalUsd,
				confidence,
				persistenceState
			});
		}
		return zones.sort((a, b) => b.heat - a.heat);
	}
	/**
	* WCI = (Total Buy Usd - Total Sell Usd) / Total Usd
	* Range: -1 (Strong Sell Control) to +1 (Strong Buy Control)
	*/
	getWhaleControlIndex(exchange, symbol) {
		const pool = this.entityPools.get(exchange);
		if (!pool) return 0;
		const all = Array.from(pool.values()).filter((e) => e.symbol === symbol && e.spoofScore < 40);
		const totalBuy = all.filter((e) => e.side === "Buy").reduce((s, e) => s + e.totalUsd, 0);
		const totalSell = all.filter((e) => e.side === "Sell").reduce((s, e) => s + e.totalUsd, 0);
		const total = totalBuy + totalSell;
		if (total === 0) return 0;
		return (totalBuy - totalSell) / total;
	}
	getWhaleControlFlow(exchange, symbol) {
		return this.wciFlows[`${exchange}_${symbol}`] || 0;
	}
};
//#endregion
//#region src/lib/r5Engine.ts
var RegimeEngine = class {
	/**
	* Classifies market state from price / EMA / ATR data.
	* Prioritises volatility first (flash-crash safety), then trend.
	*/
	getRegime(params) {
		const { price, ema21, ema200, atr14 } = params;
		if (atr14 / price > .02) return "high_volatility";
		if (price > ema200 && ema21 > ema200) return "trend_up";
		if (price < ema200 && ema21 < ema200) return "trend_down";
		return "range";
	}
	/** Returns a human-readable label with emoji for UI display */
	label(regime) {
		switch (regime) {
			case "trend_up": return "📈 趨勢上行";
			case "trend_down": return "📉 趨勢下行";
			case "high_volatility": return "⚡ 高波動";
			case "range": return "🔲 箱型整理";
		}
	}
};
/**
* Calibrates inter-stream time offset using matched (book_change, trade) pairs.
* Uses median to stay robust against network jitter outliers.
*/
var OffsetCalibrator = class {
	samples = [];
	MAX_SAMPLES = 200;
	recordMatch(bookTs, tradeTs) {
		this.samples.push({
			bookTs,
			tradeTs
		});
		if (this.samples.length > this.MAX_SAMPLES) this.samples.shift();
	}
	/** Median of (tradeTs - bookTs) differences */
	computeOffset() {
		if (this.samples.length < 5) return 0;
		const diffs = this.samples.map((s) => s.tradeTs - s.bookTs).sort((a, b) => a - b);
		return diffs[Math.floor(diffs.length / 2)];
	}
};
var EventTimeNormalizer = class {
	offsets = {
		book: 0,
		trade: 0,
		liquidation: 0
	};
	calibrators = {};
	/**
	* Returns a corrected timestamp for any stream event.
	* The offset is derived from live (book, trade) pair matching.
	*/
	normalize(ts, stream) {
		return ts + this.offsets[stream];
	}
	/**
	* Call this when a book_change and a nearby trade can be matched
	* (same price ±0.1%, within ±5 seconds).
	* Over time this auto-calibrates the book→trade offset.
	*/
	recordMatch(exchange, bookTs, tradeTs) {
		if (!this.calibrators[exchange]) this.calibrators[exchange] = new OffsetCalibrator();
		this.calibrators[exchange].recordMatch(bookTs, tradeTs);
		const offset = this.calibrators[exchange].computeOffset();
		this.offsets.book = -offset;
	}
	/** Returns current offsets for debugging / display */
	getOffsets() {
		return { ...this.offsets };
	}
};
/**
* Classifies why a wall disappeared using matched trade volume.
* R5-4: introduces 'partial' classification (previously unhandled).
*/
function classifyWallDisappear(wallQty, consumedVolume) {
	const ratio = wallQty > 0 ? consumedVolume / wallQty : 0;
	if (ratio > .8) return {
		type: "consumed",
		confidence: .9,
		consumeRatio: ratio
	};
	if (ratio < .2) return {
		type: "cancelled",
		confidence: .8,
		consumeRatio: ratio
	};
	return {
		type: "partial",
		confidence: .5,
		consumeRatio: ratio
	};
}
var MIN_SAMPLES = 30;
var PauseModel = class {
	history = [];
	MAX_HISTORY = 1e4;
	record(rec) {
		if (rec.confidenceScore <= 0) return;
		this.history.push(rec);
		if (this.history.length > this.MAX_HISTORY) this.history.shift();
	}
	/**
	* Returns weighted pause probability for a wall in a given regime.
	* Confidence scores weight each sample — low-confidence data has less influence.
	*/
	predict(wallSizeUSD, regime) {
		const relevant = this.history.filter((r) => r.regime === regime && Math.abs(r.wallSizeUSD - wallSizeUSD) / (wallSizeUSD || 1) < .5);
		if (relevant.length < MIN_SAMPLES) return {
			probability: .5,
			sampleCount: relevant.length,
			isReliable: false
		};
		let weightedPause = 0;
		let totalWeight = 0;
		for (const r of relevant) {
			const weight = r.confidenceScore;
			totalWeight += weight;
			if (r.didPause) weightedPause += weight;
		}
		const probability = totalWeight > 0 ? weightedPause / totalWeight : .5;
		return {
			probability: parseFloat(probability.toFixed(3)),
			sampleCount: relevant.length,
			isReliable: true
		};
	}
	get recordCount() {
		return this.history.length;
	}
};
/** LRU map with max-size eviction. Map preserves insertion order — oldest first. */
var WallStore = class {
	store = /* @__PURE__ */ new Map();
	MAX_SIZE;
	constructor(maxSize = 1e4) {
		this.MAX_SIZE = maxSize;
	}
	set(key, value) {
		if (this.store.has(key)) this.store.delete(key);
		this.store.set(key, value);
		if (this.store.size > this.MAX_SIZE) {
			const oldest = this.store.keys().next().value;
			if (oldest) this.store.delete(oldest);
		}
	}
	get(key) {
		return this.store.get(key);
	}
	delete(key) {
		this.store.delete(key);
	}
	get size() {
		return this.store.size;
	}
	values() {
		return this.store.values();
	}
};
var R5Engine = class {
	timeNormalizer = new EventTimeNormalizer();
	regimeEngine = new RegimeEngine();
	pauseModel = new PauseModel();
	wallStore = new WallStore();
	regimes = /* @__PURE__ */ new Map();
	/** Call every time you have fresh EMA + ATR data for a symbol */
	updateRegime(symbol, price, ema21, ema200, atr14) {
		this.regimes.set(symbol, this.regimeEngine.getRegime({
			price,
			ema21,
			ema200,
			atr14
		}));
	}
	getRegime(symbol) {
		return this.regimes.get(symbol) ?? "range";
	}
	getRegimeLabel(symbol) {
		return this.regimeEngine.label(this.getRegime(symbol));
	}
	/** Helper to compute EMA */
	static calcEMA(closes, period) {
		if (closes.length < period) return closes[closes.length - 1] || 0;
		let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
		const k = 2 / (period + 1);
		for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
		return ema;
	}
	/** Helper to compute ATR */
	static calcATR(highs, lows, closes, period) {
		if (highs.length < period + 1) return 0;
		const trs = [];
		for (let i = 1; i < highs.length; i++) {
			const hl = highs[i] - lows[i];
			const hc = Math.abs(highs[i] - closes[i - 1]);
			const lc = Math.abs(lows[i] - closes[i - 1]);
			trs.push(Math.max(hl, hc, lc));
		}
		return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
	}
	/**
	* Main signal generation for a wall.
	*/
	evaluateWall(symbol, wallSizeUSD) {
		const regime = this.getRegime(symbol);
		const { probability, sampleCount, isReliable } = this.pauseModel.predict(wallSizeUSD, regime);
		let verdict;
		if (!isReliable) verdict = `⚪ 樣本不足 (${sampleCount}/30)，謹慎參考`;
		else if (probability >= .7) verdict = `🟢 高概率停頓 ${(probability * 100).toFixed(0)}%`;
		else if (probability >= .5) verdict = `🟡 停頓概率中等 ${(probability * 100).toFixed(0)}%`;
		else verdict = `🔴 可能被穿透 ${((1 - probability) * 100).toFixed(0)}%`;
		return {
			wallSizeUSD,
			regime,
			pauseProb: probability,
			confidence: isReliable ? 1 : sampleCount / 30,
			isReliable,
			regimeLabel: this.regimeEngine.label(regime),
			verdict
		};
	}
	/** Wire a wall disappear event into the PauseModel */
	recordWallOutcome(params) {
		const event = classifyWallDisappear(params.wallQty, params.consumedVolume);
		if (event.type === "cancelled") return;
		this.pauseModel.record({
			wallSizeUSD: params.wallSizeUSD,
			duration: params.durationMs,
			crossExCount: params.crossExCount,
			didPause: params.didPause,
			confidenceScore: event.confidence,
			regime: this.getRegime(params.symbol),
			timestamp: Date.now()
		});
	}
};
/** Singleton: one R5Engine per browser tab */
var r5Engine = new R5Engine();
//#endregion
//#region src/lib/components/WhaleOrderBook.svelte
function WhaleOrderBook($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { visible = true } = $$props;
		let activeZones = {};
		new LiquidityEngine();
		let allZones = derived(() => Object.entries(activeZones).flatMap(([sym, zones]) => zones.map((z) => ({
			symbol: sym,
			...z
		}))).sort((a, b) => b.heat - a.heat));
		if (visible) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="whale-alerts-wrap svelte-1parhte"><div class="header svelte-1parhte"><span class="pulse svelte-1parhte"></span> <h3 class="svelte-1parhte">實體級 流動性空間 (Entity-Level Zones)</h3> <span class="regime-badge svelte-1parhte">🔲 箱型整理</span></div> <div class="alerts-grid svelte-1parhte"><!--[-->`);
			const each_array = ensure_array_like(allZones());
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let zone = each_array[$$index];
				const sig = r5Engine.evaluateWall(zone.symbol, zone.totalUsd || 0);
				$$renderer.push(`<div${attr_class("zone-box svelte-1parhte", void 0, {
					"wall": zone.type === "Wall",
					"trap": zone.type === "Trap",
					"void": zone.type === "Void",
					"buy": zone.side === "Buy",
					"sell": zone.side === "Sell"
				})}${attr_style(`opacity: ${stringify(.4 + zone.heat / 100 * .6)}`)}><div class="z-top svelte-1parhte"><span${attr_class("z-type svelte-1parhte", void 0, { "confirmed": zone.persistenceState === "CONFIRMED" })}>`);
				if (zone.type === "Wall") {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`${escape_html(zone.side === "Buy" ? "支撐 (多)" : "壓力 (空)")}`);
				} else if (zone.type === "Trap") {
					$$renderer.push("<!--[1-->");
					$$renderer.push(`陷阱 (危)`);
				} else {
					$$renderer.push("<!--[-1-->");
					$$renderer.push(`真空 (破)`);
				}
				$$renderer.push(`<!--]--> `);
				if (zone.persistenceState === "CONFIRMED") {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<span class="status-check svelte-1parhte">✓</span>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></span> <span${attr_class("z-confidence svelte-1parhte", void 0, { "high": zone.confidence === "HIGH" })}>${escape_html(zone.confidence)}</span></div> <div class="z-mid svelte-1parhte"><span class="z-sym svelte-1parhte">${escape_html(zone.symbol.replace("USDT", ""))}</span></div> <div class="z-price-range svelte-1parhte"><span class="range-top svelte-1parhte">${escape_html(zone.top.toLocaleString(void 0, { maximumFractionDigits: 5 }))}</span> <div class="range-divider svelte-1parhte"></div> <span class="range-bot svelte-1parhte">${escape_html(zone.bottom.toLocaleString(void 0, { maximumFractionDigits: 5 }))}</span></div> <div class="z-info-row svelte-1parhte"><span class="z-usd svelte-1parhte">$${escape_html((zone.totalUsd / 1e6).toFixed(1))}M</span> <span${attr_class("z-verdict svelte-1parhte", void 0, { "reliable": sig.isReliable })}${attr("title", sig.verdict)}>${escape_html(sig.isReliable ? sig.pauseProb >= .7 ? "🟢" : sig.pauseProb >= .5 ? "🟡" : "🔴" : "⚪")}
                        ${escape_html((sig.pauseProb * 100).toFixed(0))}%</span></div></div>`);
			}
			$$renderer.push(`<!--]--> `);
			if (allZones().length === 0) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="empty svelte-1parhte">分析市場流動性中... 建構實體特徵碼</div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
//#region src/lib/components/AnchorZones.svelte
function AnchorZones($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { visible = true, currentPrice = 0 } = $$props;
		let zones = [];
		let showWeak = false;
		let sortedZones = derived(() => [...zones].sort((a, b) => {
			if (getGrade(a.score) === "S" && getGrade(b.score) !== "S") return -1;
			if (getGrade(b.score) === "S" && getGrade(a.score) !== "S") return 1;
			return Math.abs(a.top - currentPrice) - Math.abs(b.top - currentPrice);
		}));
		function getGrade(zone) {
			return zone.rank || "C";
		}
		function getDistance(zone, cp) {
			const pct = ((zone.poc || (zone.top + zone.bottom) / 2) - cp) / cp * 100;
			const sign = pct >= 0 ? "+" : "";
			const direction = pct >= 0 ? "↑ 上方" : "↓ 下方";
			return {
				pct: sign + Math.abs(pct).toFixed(2) + "%",
				direction,
				isAbove: pct >= 0,
				absPct: Math.abs(pct)
			};
		}
		if (visible) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="anchor-alerts-wrap svelte-v275hs"><div class="header svelte-v275hs"><span class="pulse svelte-v275hs"></span> <h3 class="svelte-v275hs">歷史市場錨點 (Anchor Engine)</h3> `);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <button class="toggle-weak svelte-v275hs">${escape_html("顯示弱錨點(C)")}</button></div> <div class="alerts-grid svelte-v275hs"><!--[-->`);
			const each_array = ensure_array_like(sortedZones());
			for (let $$index_1 = 0, $$length = each_array.length; $$index_1 < $$length; $$index_1++) {
				let zone = each_array[$$index_1];
				const grade = getGrade(zone);
				if (grade !== "C" || showWeak) {
					$$renderer.push("<!--[0-->");
					const dist = getDistance(zone, currentPrice);
					$$renderer.push(`<div${attr_class(`zone-box grade-${stringify(grade.toLowerCase())}`, "svelte-v275hs", { "flashing": dist.absPct < .5 })}><div class="z-top svelte-v275hs"><span${attr_class("z-type svelte-v275hs", void 0, {
						"support": zone.top < currentPrice,
						"resist": zone.bottom > currentPrice
					})}>${escape_html(zone.top < currentPrice ? "支撐" : "壓力")}</span> <span${attr_class("z-dist svelte-v275hs", void 0, { "close": dist.absPct < .5 })}${attr_style(`color: ${stringify(dist.absPct < .5 ? "#fbbf24" : dist.isAbove ? "#ff5252" : "#00e676")}`)}>${escape_html(dist.absPct < .5 ? "⚡ " : "")}${escape_html(dist.direction)} ${escape_html(dist.pct)}</span> <span class="z-score svelte-v275hs">[${escape_html(grade)}] ${escape_html(zone.score)}</span></div> <div class="z-stats svelte-v275hs"><div class="stat-row svelte-v275hs"><span class="label svelte-v275hs">Density</span> <span class="val svelte-v275hs"${attr_style(`color: ${stringify(zone.densityScore > 5 ? "#fbbf24" : "inherit")}`)}>${escape_html(zone.densityScore?.toFixed(1) || 0)}</span></div> <div class="stat-row svelte-v275hs" title="Live Defend Reaction Score - based on recent volume and wick rejection"><span class="label svelte-v275hs">Live Defend</span> <span class="val svelte-v275hs"${attr_style(`color: ${stringify(zone.defendReactionScore > 0 ? "#ff9800" : "inherit")}; font-weight: ${stringify(zone.defendReactionScore > 0 ? "bold" : "normal")}`)}>${escape_html(zone.defendReactionScore || 0)}</span></div> <div class="stat-row svelte-v275hs"><span class="label svelte-v275hs">Defend Rate</span> <span class="val svelte-v275hs">${escape_html((zone.defendRate * 100).toFixed(0))}%</span></div> <div class="stat-row svelte-v275hs"><span class="label svelte-v275hs">Touch</span> <span class="val svelte-v275hs">${escape_html(zone.touchCount)}</span></div></div> <div class="z-price-range svelte-v275hs"><span class="range-top svelte-v275hs">${escape_html(zone.top.toLocaleString(void 0, { maximumFractionDigits: 5 }))}</span> <div class="poc-area svelte-v275hs" title="Point of Control (Highest Volume Price)"><span class="poc-label svelte-v275hs">POC</span> <span class="poc-val svelte-v275hs">${escape_html(zone.poc?.toLocaleString(void 0, { maximumFractionDigits: 5 }))}</span></div> <span class="range-bot svelte-v275hs">${escape_html(zone.bottom.toLocaleString(void 0, { maximumFractionDigits: 5 }))}</span></div> <div class="z-tf svelte-v275hs"><!--[-->`);
					const each_array_1 = ensure_array_like(zone.timeframes);
					for (let $$index = 0, $$length = each_array_1.length; $$index < $$length; $$index++) {
						let tf = each_array_1[$$index];
						$$renderer.push(`<span class="tf-badge svelte-v275hs">${escape_html(tf)}</span>`);
					}
					$$renderer.push(`<!--]--></div> <div class="z-whale svelte-v275hs"${attr("id", `whale-anchor-${stringify(zone.top)}`)} style="display:none;"></div></div>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]-->`);
			}
			$$renderer.push(`<!--]--> `);
			if (zones.length === 0) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="empty svelte-v275hs">${escape_html("當下價格周圍 (3%~15%) 無已確認的歷史防線")}</div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></div></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
//#region src/routes/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const coinToBinance = {
			bitcoin: "BTCUSDT",
			ethereum: "ETHUSDT",
			solana: "SOLUSDT",
			binancecoin: "BNBUSDT",
			ripple: "XRPUSDT",
			dogecoin: "DOGEUSDT",
			cardano: "ADAUSDT",
			"avalanche-2": "AVAXUSDT",
			polkadot: "DOTUSDT",
			"matic-network": "MATICUSDT",
			chainlink: "LINKUSDT",
			litecoin: "LTCUSDT",
			cosmos: "ATOMUSDT",
			uniswap: "UNIUSDT",
			near: "NEARUSDT",
			aptos: "APTUSDT",
			optimism: "OPUSDT",
			arbitrum: "ARBUSDT",
			sui: "SUIUSDT",
			sei: "SEIUSDT",
			"shiba-inu": "SHIBUSDT",
			pepe: "PEPEUSDT",
			tron: "TRXUSDT"
		};
		let selectedCoinName = "Bitcoin";
		let selectedBinanceSymbol = "BTCUSDT";
		let detailOpen = false;
		let showHot = true;
		let showAlerts = true;
		let showAnchor = true;
		let currentPrices = {};
		let showRightPanel = derived(() => showHot);
		function handleRankingCoinSelect(coin) {
			if (coin.binanceSymbol) {
				selectedBinanceSymbol = coin.binanceSymbol;
				selectedCoinName = coin.binanceSymbol.replace("USDT", "");
				binanceToCoinId[coin.binanceSymbol.replace("USDT", "").toLowerCase()];
			} else {
				coin.id;
				selectedCoinName = coin.name;
				selectedBinanceSymbol = coinToBinance[coin.id] || `${coin.symbol?.toUpperCase()}USDT`;
			}
		}
		const binanceToCoinId = Object.fromEntries(Object.entries(coinToBinance).map(([cgId, bSymbol]) => [bSymbol.replace("USDT", "").toLowerCase(), cgId]));
		let tradeSuggestion = derived(() => {
			return null;
		});
		let marqueeNews = [];
		head("1uha8ag", $$renderer, ($$renderer) => {
			$$renderer.title(($$renderer) => {
				$$renderer.push(`<title>TradingMonitor — 加密貨幣即時儀表板</title>`);
			});
			$$renderer.push(`<meta name="description" content="即時監控加密貨幣市場：K線圖表、漲跌幅排行、板塊分析、波動預警一站掌握" class="svelte-1uha8ag"/>`);
		});
		$$renderer.push(`<div class="dashboard svelte-1uha8ag">`);
		if (marqueeNews.length > 0) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="news-marquee svelte-1uha8ag"><div class="marquee-content svelte-1uha8ag"><!--[-->`);
			const each_array = ensure_array_like(marqueeNews);
			for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
				let news = each_array[$$index];
				$$renderer.push(`<span class="marquee-item svelte-1uha8ag"><span class="m-source svelte-1uha8ag">[${escape_html(news.source)}]</span> <a${attr("href", news.url)} target="_blank" rel="noopener" class="svelte-1uha8ag">${escape_html(news.title)}</a></span>`);
			}
			$$renderer.push(`<!--]--></div></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> <header class="dash-header svelte-1uha8ag"><div class="logo-area svelte-1uha8ag"><div class="logo-icon svelte-1uha8ag"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00e676" stroke-width="2.5" class="svelte-1uha8ag"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" class="svelte-1uha8ag"></polyline><polyline points="16 7 22 7 22 13" class="svelte-1uha8ag"></polyline></svg></div> <span class="logo-text svelte-1uha8ag">TradingMonitor</span></div> <div class="search-area svelte-1uha8ag">`);
		SearchBar($$renderer);
		$$renderer.push(`<!----></div> <div class="header-actions svelte-1uha8ag"><button class="settings-trigger svelte-1uha8ag" aria-label="Settings"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svelte-1uha8ag"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" class="svelte-1uha8ag"></path><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" class="svelte-1uha8ag"></path></svg></button> <div class="header-badge svelte-1uha8ag"><span class="live-dot svelte-1uha8ag"></span> <span class="svelte-1uha8ag">LIVE</span></div></div> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></header> <main${attr_class("main-grid svelte-1uha8ag", void 0, {
			"no-news": false,
			"no-rankings": !showRightPanel(),
			"only-center": false
		})}>`);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<aside class="panel left-panel glass-card svelte-1uha8ag">`);
		NewsPanel($$renderer);
		$$renderer.push(`<!----></aside>`);
		$$renderer.push(`<!--]--> <section class="center-panel svelte-1uha8ag"><div class="glass-card chart-card svelte-1uha8ag">`);
		KlineChart($$renderer, {
			symbol: selectedBinanceSymbol,
			coinName: selectedCoinName});
		$$renderer.push(`<!----></div> <div class="glass-card detail-toggle-card svelte-1uha8ag"><button class="toggle-btn svelte-1uha8ag" id="toggle-detail"><span${attr_class("toggle-icon svelte-1uha8ag", void 0, { "open": detailOpen })}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="svelte-1uha8ag"><polyline points="6 9 12 15 18 9" class="svelte-1uha8ag"></polyline></svg></span> <span class="svelte-1uha8ag">${escape_html("展開幣種基本資料 (手動點閱)")}</span></button> `);
		$$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></div> `);
		if (tradeSuggestion()) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div${attr_class("glass-card suggestion-card svelte-1uha8ag", void 0, { "warning": tradeSuggestion().tradeStatus.includes("⚠️") })}><div class="s-head svelte-1uha8ag"><span class="s-badge svelte-1uha8ag"${attr_style(`background: ${stringify(tradeSuggestion().setup.rr >= 2 ? "#00e676" : "#fbbf24")}`)}>${escape_html(tradeSuggestion().type)}</span> <span class="s-status svelte-1uha8ag">${escape_html(tradeSuggestion().tradeStatus)}</span> <span class="s-reason svelte-1uha8ag">${escape_html(tradeSuggestion().reason)}</span></div> <div class="s-body svelte-1uha8ag"><div class="s-item svelte-1uha8ag"><span class="label svelte-1uha8ag">建議進場</span> <span class="val svelte-1uha8ag">$${escape_html(tradeSuggestion().setup.entry)}</span></div> <div class="s-item svelte-1uha8ag"><span class="label svelte-1uha8ag">目標價位</span> <span class="val svelte-1uha8ag" style="color: #00e676">$${escape_html(tradeSuggestion().setup.target)}</span></div> <div class="s-item svelte-1uha8ag"><span class="label svelte-1uha8ag">失效止損</span> <span class="val svelte-1uha8ag" style="color: #ff5252">$${escape_html(tradeSuggestion().setup.stopLoss)}</span></div> <div class="s-item svelte-1uha8ag"><span class="label svelte-1uha8ag">盈虧比 (RR)</span> <span class="val svelte-1uha8ag"${attr_style(`color: ${stringify(tradeSuggestion().setup.rr >= 2 ? "#00e676" : "#fbbf24")}`)}>${escape_html(tradeSuggestion().setup.rr)}</span></div></div></div>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></section> `);
		if (showRightPanel()) {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<aside class="panel right-panel svelte-1uha8ag">`);
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="glass-card svelte-1uha8ag">`);
			RankingCard($$renderer, {
				title: "🔥 熱門幣",
				icon: "🔥",
				type: "hot",
				onSelectCoin: handleRankingCoinSelect
			});
			$$renderer.push(`<!----></div>`);
			$$renderer.push(`<!--]--> `);
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="glass-card svelte-1uha8ag">`);
			RankingCard($$renderer, {
				title: "📈 漲幅榜",
				icon: "📈",
				type: "gainers",
				onSelectCoin: handleRankingCoinSelect
			});
			$$renderer.push(`<!----></div>`);
			$$renderer.push(`<!--]--> `);
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="glass-card svelte-1uha8ag">`);
			RankingCard($$renderer, {
				title: "📉 跌幅榜",
				icon: "📉",
				type: "losers",
				onSelectCoin: handleRankingCoinSelect
			});
			$$renderer.push(`<!----></div>`);
			$$renderer.push(`<!--]--> `);
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<div class="glass-card svelte-1uha8ag">`);
			SqueezeAlert($$renderer);
			$$renderer.push(`<!----></div>`);
			$$renderer.push(`<!--]--></aside>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--></main> `);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<section class="whale-section glass-card svelte-1uha8ag">`);
		WhaleOrderBook($$renderer, { visible: showAlerts });
		$$renderer.push(`<!----></section>`);
		$$renderer.push(`<!--]--> `);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<section class="anchor-section glass-card svelte-1uha8ag">`);
		AnchorZones($$renderer, {
			visible: showAnchor,
			currentPrice: currentPrices[selectedBinanceSymbol] || 0
		});
		$$renderer.push(`<!----></section>`);
		$$renderer.push(`<!--]--> `);
		$$renderer.push("<!--[0-->");
		$$renderer.push(`<section class="sector-section glass-card svelte-1uha8ag">`);
		SectorHeatmap($$renderer);
		$$renderer.push(`<!----></section>`);
		$$renderer.push(`<!--]--> <footer class="dash-footer svelte-1uha8ag"><span class="svelte-1uha8ag">© 2026 TradingMonitor · 資料來源：Binance · CoinGecko ·
            CryptoCompare</span></footer></div>`);
	});
}

export { _page as default };
//# sourceMappingURL=_page.svelte-DH3O14Gr.js.map
