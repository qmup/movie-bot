const { createBot } = require('../src/bot');

const token = (process.env.BOT_TOKEN || '').trim();
const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
const bot = token ? createBot(token) : null;

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

  try {
    await bot.handleUpdate(req.body);
  } catch (error) {
    console.error('Lỗi xử lý update:', error.message);
  }
  // Luôn trả 200 để Telegram không gửi lại cùng một update nhiều lần.
  res.status(200).send('ok');
};
