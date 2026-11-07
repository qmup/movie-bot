const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createZaloClient } = require('../src/zaloApi');

const token = (process.env.ZALO_BOT_TOKEN || '').trim();
const secret = (process.env.ZALO_WEBHOOK_SECRET || '').trim();
const baseUrl = (process.argv[2] || '').trim().replace(/\/+$/, '');

if (!token || !secret || !baseUrl.startsWith('https://')) {
  console.error('Cách dùng: ZALO_BOT_TOKEN=... ZALO_WEBHOOK_SECRET=... node scripts/set-zalo-webhook.js https://<domain>');
  process.exit(1);
}

(async () => {
  const result = await createZaloClient(token).call('setWebhook', {
    url: `${baseUrl}/api/zalo`,
    secret_token: secret,
  });
  const check = result?.verification;
  console.log('Webhook:', result?.url);
  console.log('Kiểm tra:', check ? `${check.outcome} · ${check.hint || ''}` : 'không có kết quả');
})().catch((error) => {
  console.error('Không đặt được webhook:', error.message);
  process.exit(1);
});
