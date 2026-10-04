const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const token = (process.env.BOT_TOKEN || '').trim();
if (!token) {
  console.error(
    'Thiếu BOT_TOKEN. Sao chép .env.example thành .env cạnh index.js và điền token mới từ BotFather.',
  );
  process.exit(1);
}

const { createBot } = require('./src/bot');

const bot = createBot(token);

bot
  .launch()
  .then(() => {
    console.log('Bot đang chạy. Nhắn tên phim trên Telegram để tìm.');
  })
  .catch((error) => {
    console.error('Không khởi động được bot:', error.message);
    process.exit(1);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
