const { Telegraf, Markup } = require('telegraf');
const { searchFilms, getFilm } = require('./nguonc');
const { buildSearchCaption, buildDetailCaption, escapeHtml } = require('./format');
const sessions = require('./session');
const { layoutEpisodeButtons } = require('./episodes');

const START_HINT = 'Gõ tên phim để tìm. Ví dụ: Hoa Thiên Cốt';

function createBot(token, options = {}) {
  const bot = new Telegraf(token);
  const api = {
    searchFilms: options.searchFilms || searchFilms,
    getFilm: options.getFilm || getFilm,
  };
  const memory = options.sessions || sessions;

  bot.start(async (ctx) => {
    await ctx.reply(START_HINT);
  });

  bot.on('text', async (ctx) => {
    const text = (ctx.message?.text || '').trim();
    if (!text || text.startsWith('/')) {
      if (text.startsWith('/') && !isStartCommand(text)) {
        await ctx.reply(START_HINT);
      }
      return;
    }
    await searchAndSend(ctx, api, memory, text, 1);
  });

  bot.on('callback_query', async (ctx) => {
    try {
      await onCallback(ctx, api, memory);
    } catch (error) {
      console.error('Lỗi nút bấm:', error.message);
      await answerOrReply(ctx, 'Có lỗi khi xử lý. Hãy tìm lại phim.');
    }
  });

  bot.catch((error) => {
    console.error('Lỗi bot:', error.message);
  });

  return bot;
}

function isStartCommand(text) {
  return text.split(/\s+/)[0].split('@')[0] === '/start';
}

function isNotModified(error) {
  return /message is not modified/i.test(error?.description || error?.message || '');
}

async function answerOrReply(ctx, text) {
  try {
    await ctx.answerCbQuery(text, { show_alert: true });
  } catch {
    await ctx.reply(text);
  }
}

async function searchAndSend(ctx, api, memory, keyword, page) {
  const query = keyword.trim().slice(0, 150);
  if (!query) {
    await ctx.reply(START_HINT);
    return;
  }

  let data;
  try {
    data = await api.searchFilms(query, page);
  } catch (error) {
    console.error('Lỗi tìm phim:', error.message);
    await ctx.reply('Không tìm được phim lúc này. Thử lại sau.');
    return;
  }

  if (data?.status && data.status !== 'success') {
    await ctx.reply('Nguồn phim trả về lỗi. Thử lại sau.');
    return;
  }

  const items = Array.isArray(data?.items) ? data.items : [];
  const paginate = data?.paginate || {};
  const totalPage = Number(paginate.total_page) || 1;
  const currentPage = Number(paginate.current_page) || page;
  const totalItems = Number(paginate.total_items);

  if (items.length === 0) {
    await ctx.reply(`Không tìm thấy phim cho “${query}”.`);
    return;
  }

  const singlePage = totalPage <= 1;
  const singleItem = items.length === 1 && (!Number.isFinite(totalItems) || totalItems <= 1);
  if (singlePage && singleItem) {
    await sendDetail(ctx, api, memory, items[0].slug);
    return;
  }

  const sessionId = memory.rememberSearch(query, currentPage, items);
  for (let index = 0; index < items.length; index += 1) {
    const rows = [[
      Markup.button.callback('Xem chi tiết', memory.detailCallback(sessionId, index)),
    ]];
    if (totalPage > 1) {
      rows.push(searchNavRow(memory, sessionId, currentPage, totalPage));
    }
    await sendCard(ctx, items[index], buildSearchCaption(items[index]), rows);
  }
}

function searchNavRow(memory, sessionId, page, totalPage) {
  const nav = [];
  if (page > 1) {
    nav.push(Markup.button.callback(
      '« Trang trước',
      memory.searchPageCallback(sessionId, page - 1),
    ));
  }
  nav.push(Markup.button.callback(
    `Trang ${page}/${totalPage}`,
    memory.searchPageCallback(sessionId, page),
  ));
  if (page < totalPage) {
    nav.push(Markup.button.callback(
      'Trang sau »',
      memory.searchPageCallback(sessionId, page + 1),
    ));
  }
  return nav;
}

async function sendDetail(ctx, api, memory, slug) {
  let data;
  try {
    data = await api.getFilm(slug);
  } catch (error) {
    console.error('Lỗi chi tiết phim:', error.message);
    await ctx.reply('Không mở được phim này. Thử lại sau.');
    return;
  }

  const movie = data?.movie;
  if (!movie || (data?.status && data.status !== 'success')) {
    await ctx.reply('Không thấy dữ liệu phim.');
    return;
  }

  const sessionId = memory.rememberFilm(movie);
  const session = memory.recall(sessionId);
  await showFilm(ctx, memory, session, { edit: false });
}

async function showFilm(ctx, memory, session, { serverIndex = null, page = 0, edit = false } = {}) {
  const servers = session.servers || [];
  let caption;
  let rows;

  if (servers.length === 1) {
    caption = buildDetailCaption(session.movie, { serverName: servers[0].name });
    rows = episodeRows(memory, session, 0, page);
  } else if (serverIndex !== null && servers[serverIndex]) {
    caption = buildDetailCaption(session.movie, { serverName: servers[serverIndex].name });
    rows = episodeRows(memory, session, serverIndex, page);
  } else if (servers.length > 1) {
    caption = buildDetailCaption(session.movie);
    rows = servers.map((server, index) => [
      Markup.button.callback(trimServer(server.name), memory.serverCallback(session.id, index)),
    ]);
  } else {
    caption = buildDetailCaption(session.movie);
    rows = [];
  }

  await present(ctx, session.movie, caption, rows, edit);
  if (servers.length === 0 && !edit) {
    await ctx.reply('Phim chưa có tập để xem.');
  }
}

function trimServer(name) {
  const value = String(name || 'Server').trim();
  return value.length <= 32 ? value : `${value.slice(0, 31)}…`;
}

function episodeRows(memory, session, serverIndex, page) {
  const server = session.servers[serverIndex];
  if (!server || server.episodes.length === 0) return [];
  const layout = layoutEpisodeButtons(server.episodes, page);
  return layout.rows.map((row) => row.map((button) => {
    if (Number.isInteger(button.episodeIndex)) {
      return Markup.button.callback(
        button.label,
        memory.watchCallback(session.id, serverIndex, button.episodeIndex),
      );
    }
    return Markup.button.callback(
      button.label,
      memory.episodePageCallback(session.id, serverIndex, button.page),
    );
  }));
}

async function present(ctx, movie, caption, rows, edit) {
  const extra = { parse_mode: 'HTML' };
  if (rows.length) {
    extra.reply_markup = Markup.inlineKeyboard(rows).reply_markup;
  }

  if (edit) {
    try {
      await ctx.editMessageCaption(caption, extra);
      return;
    } catch (error) {
      if (isNotModified(error)) return;
      try {
        await ctx.editMessageText(caption, extra);
        return;
      } catch (textError) {
        if (isNotModified(textError)) return;
      }
    }
  }

  await sendCard(ctx, movie, caption, rows);
}

async function sendCard(ctx, item, caption, rows) {
  const extra = { caption, parse_mode: 'HTML' };
  if (rows.length) {
    extra.reply_markup = Markup.inlineKeyboard(rows).reply_markup;
  }

  const urls = [item?.poster_url, item?.thumb_url].filter(
    (url, index, list) => url && list.indexOf(url) === index,
  );
  for (const url of urls) {
    try {
      await ctx.replyWithPhoto(url, extra);
      return;
    } catch (error) {
      console.error('Không gửi được ảnh:', error.message);
    }
  }

  const { caption: text, ...rest } = extra;
  await ctx.reply(text, rest);
}

async function replaceKeyboard(ctx, rows) {
  try {
    await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(rows).reply_markup);
  } catch (error) {
    if (!isNotModified(error)) throw error;
  }
}

async function sendWatchLink(ctx, server, episode) {
  if (!episode?.embed || !/^https?:\/\//i.test(episode.embed)) {
    await ctx.reply('Tập này chưa có link xem.');
    return;
  }

  const label = `Tập ${escapeHtml(episode.name)} · ${escapeHtml(server.name)}`;
  await ctx.reply(label, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[Markup.button.url('Xem phim', episode.embed)]]),
  });
}

async function onCallback(ctx, api, memory) {
  const parsed = memory.parseCallback(ctx.callbackQuery?.data);
  if (!parsed) {
    await ctx.answerCbQuery('Nút không còn dùng được. Hãy tìm lại phim.', { show_alert: true });
    return;
  }

  const session = memory.recall(parsed.id);
  if (!session) {
    await ctx.answerCbQuery(memory.EXPIRED_MESSAGE, { show_alert: true });
    return;
  }

  if (parsed.type === 'search') {
    if (session.type !== 'search' || !session.keyword) {
      await ctx.answerCbQuery(memory.EXPIRED_MESSAGE, { show_alert: true });
      return;
    }
    await ctx.answerCbQuery();
    await searchAndSend(ctx, api, memory, session.keyword, parsed.page);
    return;
  }

  if (parsed.type === 'detail') {
    const slug = session.type === 'search' ? session.slugs?.[parsed.index] : null;
    if (!slug) {
      await ctx.answerCbQuery('Không thấy phim này. Hãy tìm lại.', { show_alert: true });
      return;
    }
    await ctx.answerCbQuery();
    await sendDetail(ctx, api, memory, slug);
    return;
  }

  if (session.type !== 'film') {
    await ctx.answerCbQuery(memory.EXPIRED_MESSAGE, { show_alert: true });
    return;
  }

  const server = session.servers?.[parsed.server];
  if (!server) {
    await ctx.answerCbQuery('Không thấy server này. Hãy tìm lại phim.', { show_alert: true });
    return;
  }

  if (parsed.type === 'server' || parsed.type === 'episodes') {
    if (!server.episodes.length) {
      await ctx.answerCbQuery();
      await ctx.reply(`Server ${server.name} chưa có tập.`);
      return;
    }
    await ctx.answerCbQuery();
    const page = parsed.type === 'episodes' ? parsed.page : 0;
    if (parsed.type === 'episodes') {
      await replaceKeyboard(ctx, episodeRows(memory, session, parsed.server, page));
      return;
    }
    await showFilm(ctx, memory, session, { serverIndex: parsed.server, page, edit: true });
    return;
  }

  if (parsed.type === 'watch') {
    const episode = server.episodes[parsed.episode];
    if (!episode) {
      await ctx.answerCbQuery('Không thấy tập này. Hãy tìm lại phim.', { show_alert: true });
      return;
    }
    await ctx.answerCbQuery();
    await sendWatchLink(ctx, server, episode);
  }
}

module.exports = {
  createBot,
  START_HINT,
};
