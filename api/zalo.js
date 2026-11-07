const { waitUntil } = require('@vercel/functions');
const { createZaloClient } = require('../src/zaloApi');
const { createZaloBot } = require('../src/zaloBot');

const token = (process.env.ZALO_BOT_TOKEN || '').trim();
const secret = (process.env.ZALO_WEBHOOK_SECRET || '').trim();
const bot = token ? createZaloBot({ client: createZaloClient(token) }) : null;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  if (!bot || !secret) {
    res.status(500).send('Thiếu ZALO_BOT_TOKEN hoặc ZALO_WEBHOOK_SECRET');
    return;
  }
  if (req.headers['x-bot-api-secret-token'] !== secret) {
    res.status(401).send('Unauthorized');
    return;
  }

  waitUntil(bot.handleUpdate(req.body));
  res.status(200).json({ message: 'Success' });
};
