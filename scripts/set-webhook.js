const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Telegraf } = require('telegraf');

const token = (process.env.BOT_TOKEN || '').trim();
const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
const baseUrl = (process.argv[2] || '').trim().replace(/\/+$/, '');

if (!token || !secret || !baseUrl.startsWith('https://')) {
  console.error('Cách dùng: BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... node scripts/set-webhook.js https://<domain>');
  process.exit(1);
}

const telegram = new Telegraf(token).telegram;

(async () => {
  await telegram.setWebhook(`${baseUrl}/api/telegram`, {
    secret_token: secret,
    allowed_updates: ['message', 'callback_query'],
  });
  const info = await telegram.getWebhookInfo();
  console.log('Webhook:', info.url, '| pending:', info.pending_update_count);
})().catch((error) => {
  console.error('Không đặt được webhook:', error.message);
  process.exit(1);
});
