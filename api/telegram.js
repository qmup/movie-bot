const { waitUntil } = require('@vercel/functions');
const { createBot } = require('../src/bot');

const token = (process.env.BOT_TOKEN || '').trim();
const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
const bot = token ? createBot(token, { telegraf: { handlerTimeout: 280_000 } }) : null;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  if (!bot || !secret) {
    res.status(500).send('Thiếu BOT_TOKEN hoặc TELEGRAM_WEBHOOK_SECRET');
    return;
  }
  if (req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    res.status(401).send('Unauthorized');
    return;
  }

  // Telegram gửi lại update nếu không nhận 200 trong ~60 giây, mà gửi 10 thẻ kèm ảnh có thể lâu hơn.
  waitUntil(
    bot.handleUpdate(req.body).catch((error) => {
      console.error('Lỗi xử lý update:', error.message);
    }),
  );
  res.status(200).send('ok');
};
