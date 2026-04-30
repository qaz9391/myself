import { b as private_env } from './shared-server-9-2j12mp.js';
import { c as cachedFetch, r as rateLimitedFetch, d as cryptocompareLimiter } from './apiCache-CuQsYDwh.js';
import { j as json } from './index-De89J4_m.js';
import Parser from 'rss-parser';
import './index-DBqjc0Yf.js';

//#region src/routes/api/news/+server.ts
var parser = new Parser();
var BASE_URL = "https://min-api.cryptocompare.com/data/v2/news/";
var GET = async ({ url }) => {
	const categories = url.searchParams.get("categories") || "";
	const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
	try {
		const data = await cachedFetch(`news:${categories}:${limit}`, 6e5, async () => {
			let apiUrl = `${BASE_URL}?lang=EN&sortOrder=latest`;
			if (categories) apiUrl += `&categories=${categories}`;
			const res = await rateLimitedFetch(apiUrl, cryptocompareLimiter, { headers: { "authorization": `Apikey ${private_env.CRYPTOCOMPARE_API_KEY || ""}` } });
			if (!res.ok) throw new Error(`CryptoCompare API error: ${res.status} ${res.statusText}`);
			const articles = ((await res.json()).Data || []).slice(0, limit);
			if (articles.length === 0) console.log("[/api/news] Empty data received from CryptoCompare.");
			const ccArticles = articles.map((article) => ({
				id: article.id,
				title: article.title,
				body: article.body?.substring(0, 200) + "...",
				url: article.url,
				imageurl: article.imageurl,
				source: article.source,
				categories: article.categories,
				published_on: article.published_on,
				isBreaking: false
			}));
			let zhArticles = [];
			try {
				for (const rssUrl of ["https://rsshub.app/jin10/telegraph", "https://rsshub.app/panewslab/news"]) try {
					const items = (await parser.parseURL(rssUrl)).items.slice(0, 8).map((item, index) => ({
						id: `rss-${Date.now()}-${index}`,
						title: item.title?.replace(/<[^>]+>/g, ""),
						body: item.contentSnippet?.substring(0, 200) + "...",
						url: item.link,
						imageurl: "",
						source: rssUrl.includes("jin10") ? "金十數據" : "PANews",
						categories: "Crypto|Macro",
						published_on: item.pubDate ? Math.floor(new Date(item.pubDate).getTime() / 1e3) : Math.floor(Date.now() / 1e3),
						isBreaking: true
					}));
					zhArticles = [...zhArticles, ...items];
				} catch (e) {
					console.error("Failed to parse RSS:", rssUrl, e);
				}
			} catch (e) {
				console.log("RSS Fetch failed", e);
			}
			return [...zhArticles, ...ccArticles].sort((a, b) => b.published_on - a.published_on).slice(0, limit);
		});
		if (data.length === 0) {}
		return json(data);
	} catch (err) {
		console.error("[/api/news] Error:", err.message);
		return json([]);
	}
};

export { GET };
//# sourceMappingURL=_server.ts-DEmCjPON.js.map
