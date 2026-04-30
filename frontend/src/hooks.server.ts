import cron from 'node-cron';
import { sendSqueezeTelegram } from '$lib/server/telegram';

let isCronStarted = false;

// Start cron job only once
if (!isCronStarted) {
    isCronStarted = true;
    
    // Run every 2 hours (0 */2 * * *)
    cron.schedule('0 */2 * * *', () => {
        sendSqueezeTelegram();
    });
    
    console.log('[System] Telegram notification cron initialized.');
}
