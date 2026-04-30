import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendSqueezeTelegram } from '$lib/server/telegram';

export const POST: RequestHandler = async () => {
    try {
        const result = await sendSqueezeTelegram();
        return json(result);
    } catch (e: any) {
        return json({ success: false, message: e.message }, { status: 500 });
    }
};
