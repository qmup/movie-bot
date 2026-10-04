require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf('8538322153:AAHpq8JPJ0zj5sW2Bg7lg7QVXf8BDY3rxmc');

// Hiển thị chi tiết phim sau khi chọn
async function showMovieDetail(ctx, slug) {
  try {
    const url = `https://ophim1.com/v1/api/phim/${slug}`;

    const res = await axios.get(url);
    const data = res.data;

    if (data.status !== "success") {
      return ctx.reply("❌ Không tìm thấy phim!");
    }

    const item = data.data.item;

    const imageDomain = data.data.APP_DOMAIN_CDN_IMAGE || "https://img.ophim.live";
    const poster = `${imageDomain}/uploads/movies/${item.thumb_url}`;

    // Gom thông tin phụ
    const categories = item.category?.map(c => c.name).join(", ") || "N/A";
    const countries = item.country?.map(c => c.name).join(", ") || "N/A";

    const rating =
      item.imdb?.vote_average
        ? `🎖 IMDb: ${item.imdb.vote_average}`
        : item.tmdb?.vote_average
        ? `🎖 TMDB: ${item.tmdb.vote_average}`
        : "";

    let message =
`🎬 <b>${item.name}</b> (${item.year})

🕒 Thời lượng: ${item.time}
🌎 Quốc gia: ${countries}
🎭 Thể loại: ${categories}
🔤 Ngôn ngữ: ${item.lang}
⭐ Chất lượng: ${item.quality}
📀 Trạng thái: ${item.episode_current}

${rating}

📝 <b>Nội dung:</b>
${item.content.replace(/<[^>]+>/g, "").slice(0, 300)}...

📺 <b>Danh sách tập:</b>\n`;

    const episodes = item.episodes;

    episodes.forEach((server) => {
      message += `\n🎥 <b>Server: ${server.server_name}</b>\n`;

      server.server_data.forEach((ep, index) => {
        const episodeName = ep.name || `Tập ${index + 1}`;
        message += `▶️ <a href="${ep.link_embed}">${episodeName}</a>\n`;
      });
    });

    // Gửi kèm ảnh để user biết chắc đã chọn đúng phim
    await ctx.replyWithPhoto(poster, {
      caption: message,
      parse_mode: "HTML",
      disable_web_page_preview: true
    });

  } catch (err) {
    console.error(err);
    ctx.reply("⚠️ Lỗi khi lấy thông tin phim");
  }
}

bot.start((ctx) => {
  ctx.reply("Chào bạn 👋\nHãy nhập tên phim để tìm kiếm!");
});

// Xử lý tìm kiếm
bot.on('text', async (ctx) => {
  const keyword = ctx.message.text.trim();

  ctx.reply(`🔎 Đang tìm: <b>${keyword}</b>`, { parse_mode: "HTML" });

  try {
    const searchUrl = `https://ophim1.com/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}`;

    const res = await axios.get(searchUrl);

    const data = res.data.data;
    const items = data.items;

    if (!items || items.length === 0) {
      return ctx.reply("❌ Không tìm thấy phim nào!");
    }

    // Nếu chỉ có 1 kết quả -> vào thẳng chi tiết
    if (items.length === 1) {
      return showMovieDetail(ctx, items[0].slug);
    }

    const imageDomain = data.APP_DOMAIN_CDN_IMAGE;

    const topMovies = items.slice(0, 5);

    for (let movie of topMovies) {
      const imageUrl = `${imageDomain}/uploads/movies/${movie.thumb_url}`;

      const caption =
`🎬 <b>${movie.name}</b>
📅 Năm: ${movie.year}
⏱ ${movie.time}
⭐ ${movie.quality}
📀 ${movie.episode_current}`;

      try {
        await ctx.replyWithPhoto(imageUrl, {
          caption,
          parse_mode: "HTML",
          ...Markup.inlineKeyboard([
            Markup.button.callback("Xem chi tiết", `select_${movie.slug}`)
          ])
        });
      } catch {
        // fallback nếu ảnh lỗi
        await ctx.reply(
          caption,
          {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard([
              Markup.button.callback("Xem chi tiết", `select_${movie.slug}`)
            ])
          }
        );
      }
    }

  } catch (err) {
    console.error(err);
    ctx.reply("⚠️ Lỗi khi tìm kiếm phim");
  }
});

// Khi user bấm chọn phim
bot.action(/select_(.+)/, async (ctx) => {
  const slug = ctx.match[1];

  await ctx.answerCbQuery();

  showMovieDetail(ctx, slug);
});

bot.launch();

console.log("Bot đã chạy!");