import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
    const symbol = url.searchParams.get('symbol') || 'BTCUSDT';
    const interval = url.searchParams.get('interval') || '4h';
    const limit = url.searchParams.get('limit') || '300';

    try {
        const apiUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
        const res = await fetch(apiUrl);
        
        if (!res.ok) {
            return json({ error: `Binance returned ${res.status}` }, { status: res.status });
        }

        const data = await res.json();
        
        const formatted = data.map((k: any[]) => ({
            time: Math.floor(k[0] / 1000),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
        }));

        return json(formatted);
    } catch (err: any) {
        return json({ error: err.message }, { status: 500 });
    }
};
