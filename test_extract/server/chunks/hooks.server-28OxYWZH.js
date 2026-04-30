import { b as private_env } from './shared-server-9-2j12mp.js';
import cron from 'node-cron';

//#region src/hooks.server.ts
var isCronStarted = false;
async function sendSqueezeTelegram() {
	const botToken = private_env.TELEGRAM_BOT_TOKEN;
	const chatId = private_env.TELEGRAM_CHAT_ID;
	if (!botToken || !chatId) {
		console.log("[Telegram Bot] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env, skipping notification.");
		return;
	}
	try {
		console.log("[Telegram Bot] Fetching Squeeze data for notification...");
		const baseUrl = private_env.APP_URL || "http://localhost:3000";
		const [res1h, res4h, res1d] = await Promise.all([
			fetch(`${baseUrl}/api/squeeze?timeframe=1h`).then((r) => r.json()),
			fetch(`${baseUrl}/api/squeeze?timeframe=4h`).then((r) => r.json()),
			fetch(`${baseUrl}/api/squeeze?timeframe=1d`).then((r) => r.json())
		]);
		const formatList = (data) => {
			const highConsensus = data.filter((d) => d.bias && d.bias.agreementScore >= 75);
			if (highConsensus.length === 0) return "無";
			return highConsensus.map((d) => {
				return `${d.bias.score > 0 ? "🟢" : "🔴"} $${d.symbol.toUpperCase()} (${d.bias.agreementLabel})`;
			}).join("\n  ");
		};
		const textMsg = `🚨 波動預警清單 (Squeeze Alerts) 🚨\n\n【1H 日內短線機會】\n  ${formatList(res1h)}\n\n【4H 波段關鍵收斂】\n  ${formatList(res4h)}\n\n【1D 長線大波動準備】\n  ${formatList(res1d)}\n\n#Crypto #TradingMonitor`;
		const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				chat_id: chatId,
				text: textMsg
			})
		});
		if (!tgRes.ok) console.error("[Telegram Bot] Error sending message:", await tgRes.text());
		else console.log("[Telegram Bot] Telegram notification sent successfully!");
	} catch (e) {
		console.error("[Telegram Bot] Failed to send notification:", e);
	}
}
if (!isCronStarted) {
	isCronStarted = true;
	cron.schedule("0 */2 * * *", () => {
		sendSqueezeTelegram();
	});
	console.log("[System] Telegram notification cron initialized.");
}
//# sourceMappingURL=hooks.server-28OxYWZH.js.map
