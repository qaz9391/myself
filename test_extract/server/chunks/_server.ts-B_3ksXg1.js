import { j as json } from './index-De89J4_m.js';
import './index-DBqjc0Yf.js';

//#region \0virtual:env/static/private
/** @type {import('$env/static/private').ANTHROPIC_API_KEY} */
var ANTHROPIC_API_KEY = "sk-AJaXKRRlEPylb3Vl6yAPlNMSjC95v9gvHv0q3QROOpgsSgKJ";
//#endregion
//#region src/routes/api/ai-advice/+server.ts
var POST = async ({ request }) => {
	try {
		const { symbol, price, anchor, squeeze, wci, bias } = await request.json();
		const prompt = `
        你是一位專業的加密貨幣量化分析師。請根據以下技術數據，為幣種 ${symbol} 提供一段大約 100 字的「AI 進場邏輯分析」。
        使用繁體中文，語氣專業且精煉。

        當前價格: ${price}
        歷史錨點 (Anchor): 支撐位 ${anchor.top}, 分數 ${anchor.score} (S/A/B/C等級: ${anchor.rank || "N/A"})
        波動預警 (Squeeze): 橫盤 ${squeeze.count} 根 K 棒, 型態 ${squeeze.pattern?.type || "收斂"}
        大戶意圖 (Whale Index): WCI 指數 ${wci.toFixed(2)} (-1至1, 正數代表買方控制)
        多空共振評分: ${bias.agreementLabel} (${bias.agreementCount}/4)
        綜合預測: ${bias.direction} (得分: ${bias.score})

        請分析支撐的強度、大戶意圖與型態突破的可能性，並給出具體的「操作核心建議」。
        `;
		const advice = (await (await fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				"x-api-key": ANTHROPIC_API_KEY,
				"anthropic-version": "2023-06-01",
				"content-type": "application/json"
			},
			body: JSON.stringify({
				model: "claude-3-5-sonnet-20241022",
				max_tokens: 500,
				messages: [{
					role: "user",
					content: prompt
				}]
			})
		})).json()).content[0].text;
		return json({ advice });
	} catch (error) {
		console.error("Claude API Error:", error);
		return json({ advice: "AI 顧問暫時離線，請參考技術面指標。" }, { status: 500 });
	}
};

export { POST };
//# sourceMappingURL=_server.ts-B_3ksXg1.js.map
