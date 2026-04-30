const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["robots.txt"]),
	mimeTypes: {".txt":"text/plain"},
	_: {
		client: {start:"_app/immutable/entry/start.CIFi0AUW.js",app:"_app/immutable/entry/app.DHHtdHRP.js",imports:["_app/immutable/entry/start.CIFi0AUW.js","_app/immutable/chunks/-9fV-h41.js","_app/immutable/chunks/tfDKAiye.js","_app/immutable/entry/app.DHHtdHRP.js","_app/immutable/chunks/tfDKAiye.js","_app/immutable/chunks/Dj6f-nJM.js","_app/immutable/chunks/DEDqjojZ.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./chunks/0-Cvl-Smla.js')),
			__memo(() => import('./chunks/1-C9F8NMVr.js')),
			__memo(() => import('./chunks/2-BiJKKti1.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/api/ai-advice",
				pattern: /^\/api\/ai-advice\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-B_3ksXg1.js'))
			},
			{
				id: "/api/coin",
				pattern: /^\/api\/coin\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-B7aW2qfD.js'))
			},
			{
				id: "/api/kline",
				pattern: /^\/api\/kline\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-D_MmK_9B.js'))
			},
			{
				id: "/api/market",
				pattern: /^\/api\/market\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-BDnkdrDl.js'))
			},
			{
				id: "/api/news",
				pattern: /^\/api\/news\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-DEmCjPON.js'))
			},
			{
				id: "/api/search",
				pattern: /^\/api\/search\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-Cy9A1V_n.js'))
			},
			{
				id: "/api/sector-coins",
				pattern: /^\/api\/sector-coins\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-BK62rJrv.js'))
			},
			{
				id: "/api/sectors",
				pattern: /^\/api\/sectors\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-BaIuOLjL.js'))
			},
			{
				id: "/api/squeeze",
				pattern: /^\/api\/squeeze\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-BraLfqqT.js'))
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

const prerendered = new Set([]);

const base = "";

export { base, manifest, prerendered };
//# sourceMappingURL=manifest.js.map
