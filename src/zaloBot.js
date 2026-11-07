const { searchFilms, getFilm } = require('./nguonc');
const { findFilms, isSingleResult } = require('./catalog');
const { stripHtml, truncateText, categoryNames } = require('./format');
const { buildWatchUrl, filmPageUrl } = require('./watchUrl');
const sessions = require('./session');

const TEXT_LIMIT = 2000;
const NAME_LIMIT = 90;
const DESCRIPTION_LIMIT = 600;

const HELP = [
  '🎬 Gõ tên phim để tìm. Ví dụ: Hoa Thiên Cốt',
  '',
  '• Gõ số thứ tự để xem chi tiết một phim trong danh sách',
  '• "tiếp" / "trước" để đổi trang kết quả, "ds" để xem lại danh sách',
  '• Đang xem phim: gõ số tập (ví dụ 1180) để lấy link, "mới" để lấy tập mới nhất',
  '• "server 2" để đổi server',
  '• Tên phim là con số thì gõ "tìm 1917"',
].join('\n');

const NO_LIST = '📭 Chưa có danh sách. Gõ tên phim để tìm.';
const NO_FILM = '📭 Chưa chọn phim. Gõ tên phim để tìm rồi gõ số thứ tự.';

const WORDS = {
  help: ['/start', 'start', '/help', 'help', 'huong dan', 'hd', '?'],
  next: ['tiep', 'sau', 'trang sau', 'next', '>', '>>'],
  prev: ['truoc', 'trang truoc', 'prev', '<', '<<'],
  list: ['ds', 'danh sach', 'list', 'quay lai'],
  latest: ['moi', 'moi nhat', 'tap moi', 'tap moi nhat', 'cuoi', 'tap cuoi'],
};

function fold(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCommand(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  const key = fold(raw);
  if (!key) return { type: 'help' };

  for (const [type, words] of Object.entries(WORDS)) {
    if (words.includes(key)) return { type };
  }

  let match = key.match(/^trang (\d+)$/);
  if (match) return { type: 'page', page: Number(match[1]) };

  match = key.match(/^(?:server|sv) (\d+)$/);
  if (match) return { type: 'server', index: Number(match[1]) };

  match = key.match(/^(?:tap|ep) (\d+)$/);
  if (match) return { type: 'episode', number: Number(match[1]) };

  if (/^\d+$/.test(key)) return { type: 'number', value: Number(key) };

  match = raw.match(/^(?:tìm|tim)\s+(.+)$/i);
  if (match) return { type: 'search', keyword: match[1] };

  return { type: 'search', keyword: raw };
}

function clip(text, limit) {
  return truncateText(String(text || '').trim(), limit);
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function searchListText(found) {
  const lines = [`🔎 “${found.query}” · trang ${found.currentPage}/${found.totalPage}`, ''];
  found.items.forEach((item, index) => {
    const year = hasValue(item.year) ? ` (${item.year})` : '';
    const status = hasValue(item.current_episode) ? ` · ${item.current_episode}` : '';
    lines.push(`${index + 1}. ${clip(item.name || 'Chưa rõ tên', NAME_LIMIT)}${year}${status}`);
  });
  lines.push('', `👉 Gõ số 1–${found.items.length} để xem chi tiết.`);
  const paging = [];
  if (found.currentPage < found.totalPage) paging.push('"tiếp" sang trang sau');
  if (found.currentPage > 1) paging.push('"trước" về trang trước');
  if (paging.length) lines.push(`Gõ ${paging.join(', ')}.`);
  return clip(lines.join('\n'), TEXT_LIMIT);
}

function field(icon, label, value) {
  return hasValue(value) ? `${icon} ${label}: ${String(value).trim()}` : '';
}

function detailText(movie, serverName) {
  const lines = [
    `🎬 ${clip(movie.name || 'Chưa rõ tên', 200)}`,
    hasValue(movie.original_name) ? clip(movie.original_name, 200) : '',
    field('📅', 'Năm', movie.year),
    field('⏱', 'Thời lượng', movie.time),
    field('🎞', 'Chất lượng', movie.quality),
    field('🗣', 'Ngôn ngữ', movie.language),
    field('📺', 'Trạng thái', movie.current_episode),
    field('🏷', 'Thể loại', categoryNames(movie, 'Thể loại')),
    field('🌍', 'Quốc gia', categoryNames(movie, 'Quốc gia')),
    field('📡', 'Server', serverName),
  ].filter(Boolean);
  const description = clip(stripHtml(movie.description || ''), DESCRIPTION_LIMIT);
  const text = description ? `${lines.join('\n')}\n\n${description}` : lines.join('\n');
  return clip(text, TEXT_LIMIT);
}

function episodeNumber(name) {
  const match = String(name || '').match(/^\D*(\d+)\D*$/);
  return match ? Number(match[1]) : null;
}

function findEpisode(episodes, number) {
  const byName = episodes.findIndex((episode) => episodeNumber(episode.name) === number);
  if (byName >= 0) return byName;
  return number >= 1 && number <= episodes.length ? number - 1 : -1;
}

function episodeLabel(episode, index) {
  return String(episode?.name || '').trim() || String(index + 1);
}

function watchLink(film, episode) {
  return buildWatchUrl(episode?.embed, { filmSlug: film.slug }) || filmPageUrl(film.slug);
}

function serverList(film) {
  return film.servers
    .map((server, index) => `${index + 1}. ${server.name || 'Server'}${index === film.server ? ' ✓' : ''}`)
    .join('\n');
}

function episodeGuide(film) {
  const server = film.servers[film.server];
  const episodes = server?.episodes || [];
  if (!episodes.length) return '😕 Phim chưa có tập để xem.';

  const lines = [];
  if (episodes.length === 1) {
    lines.push(`▶️ Xem phim: ${watchLink(film, episodes[0])}`);
  } else {
    const first = episodeLabel(episodes[0], 0);
    const last = episodeLabel(episodes.at(-1), episodes.length - 1);
    lines.push(
      `📺 ${episodes.length} tập (${first} → ${last}).`,
      `👉 Gõ số tập để lấy link, ví dụ: ${episodeNumber(last) ?? episodes.length}. Gõ "mới" để lấy tập mới nhất.`,
    );
  }
  if (film.servers.length > 1) {
    lines.push('', `📡 Server (gõ "server <số>" để đổi):`, serverList(film));
  }
  return clip(lines.join('\n'), TEXT_LIMIT);
}

function createZaloBot({ client, api = {}, memory = sessions } = {}) {
  const catalog = {
    searchFilms: api.searchFilms || searchFilms,
    getFilm: api.getFilm || getFilm,
  };

  async function send(chatId, text) {
    await client.sendMessage(chatId, clip(text, TEXT_LIMIT));
  }

  async function typing(chatId) {
    try {
      await client.sendTyping(chatId);
    } catch {
      // Chỉ là hiệu ứng "đang nhập", lỗi thì bỏ qua.
    }
  }

  async function search(chatId, state, keyword, page) {
    await typing(chatId);
    let found;
    try {
      found = await findFilms(catalog.searchFilms, keyword, page);
    } catch (error) {
      console.error('Zalo: lỗi tìm phim:', error.message);
      await send(chatId, '⚠️ Không tìm được phim lúc này. Thử lại sau.');
      return;
    }

    if (found.status === 'empty') {
      await send(chatId, HELP);
      return;
    }
    if (found.status === 'error') {
      await send(chatId, '⚠️ Nguồn phim trả về lỗi. Thử lại sau.');
      return;
    }
    if (found.items.length === 0) {
      await send(chatId, `😕 Không tìm thấy phim cho “${found.query}”.`);
      return;
    }
    if (isSingleResult(found)) {
      await openFilm(chatId, { ...state, search: null }, found.items[0].slug);
      return;
    }

    const next = {
      ...state,
      mode: 'search',
      search: {
        keyword: found.usedQuery,
        page: found.currentPage,
        totalPage: found.totalPage,
        slugs: found.items.map((item) => item.slug),
      },
    };
    await memory.saveChat(chatId, next);
    await send(chatId, searchListText(found));
  }

  async function openFilm(chatId, state, slug) {
    await typing(chatId);
    let data;
    try {
      data = await catalog.getFilm(slug);
    } catch (error) {
      console.error('Zalo: lỗi chi tiết phim:', error.message);
      await send(chatId, '⚠️ Không mở được phim này. Thử lại sau.');
      return;
    }
    const movie = data?.movie;
    if (!movie || (data?.status && data.status !== 'success')) {
      await send(chatId, '😕 Không thấy dữ liệu phim.');
      return;
    }

    const film = { ...memory.filmRecord(movie), server: 0 };
    await memory.saveChat(chatId, { ...state, mode: 'film', film });

    const caption = detailText(film.movie, film.servers[0]?.name);
    const poster = movie.poster_url || movie.thumb_url;
    let sentPhoto = false;
    if (poster) {
      try {
        await client.sendPhoto(chatId, poster, caption);
        sentPhoto = true;
      } catch (error) {
        console.error('Zalo: không gửi được ảnh:', error.message);
      }
    }
    if (!sentPhoto) await send(chatId, caption);
    await send(chatId, episodeGuide(film));
  }

  async function sendEpisode(chatId, film, index) {
    const episodes = film.servers[film.server]?.episodes || [];
    const episode = episodes[index];
    const link = watchLink(film, episode);
    if (!link) {
      await send(chatId, '😕 Tập này chưa có link xem.');
      return;
    }
    const name = clip(film.movie?.name || 'Phim', NAME_LIMIT);
    const lines = [`▶️ ${name} · Tập ${episodeLabel(episode, index)}`, link];
    if (index + 1 < episodes.length) {
      const nextLabel = episodeLabel(episodes[index + 1], index + 1);
      lines.push('', `Tập tiếp theo: gõ ${episodeNumber(nextLabel) ?? index + 2}`);
    }
    await send(chatId, lines.join('\n'));
  }

  async function askEpisode(chatId, film, number) {
    const episodes = film.servers[film.server]?.episodes || [];
    if (!episodes.length) {
      await send(chatId, '😕 Server này chưa có tập.');
      return;
    }
    const index = findEpisode(episodes, number);
    if (index < 0) {
      const first = episodeLabel(episodes[0], 0);
      const last = episodeLabel(episodes.at(-1), episodes.length - 1);
      await send(chatId, `😕 Không có tập ${number}. Phim có ${episodes.length} tập (${first} → ${last}).`);
      return;
    }
    await sendEpisode(chatId, film, index);
  }

  async function handleText(chatId, text) {
    const state = (await memory.loadChat(chatId)) || {};
    const command = parseCommand(text);
    const film = state.mode === 'film' ? state.film : null;

    switch (command.type) {
      case 'help':
        await send(chatId, HELP);
        return;
      case 'search':
        await search(chatId, state, command.keyword, 1);
        return;
      case 'next':
      case 'prev':
      case 'page': {
        if (!state.search) {
          await send(chatId, NO_LIST);
          return;
        }
        const { page, totalPage } = state.search;
        let target = page;
        if (command.type === 'next') target = page + 1;
        if (command.type === 'prev') target = page - 1;
        if (command.type === 'page') target = command.page;
        if (target < 1 || target > totalPage) {
          await send(chatId, `📄 Chỉ có trang 1–${totalPage}.`);
          return;
        }
        await search(chatId, state, state.search.keyword, target);
        return;
      }
      case 'list':
        if (!state.search) {
          await send(chatId, NO_LIST);
          return;
        }
        await search(chatId, state, state.search.keyword, state.search.page);
        return;
      case 'number':
        if (film) {
          await askEpisode(chatId, film, command.value);
          return;
        }
        if (state.search && command.value >= 1 && command.value <= state.search.slugs.length) {
          await openFilm(chatId, state, state.search.slugs[command.value - 1]);
          return;
        }
        await search(chatId, state, String(command.value), 1);
        return;
      case 'episode':
        if (!film) {
          await send(chatId, NO_FILM);
          return;
        }
        await askEpisode(chatId, film, command.number);
        return;
      case 'latest': {
        if (!film) {
          await send(chatId, NO_FILM);
          return;
        }
        const episodes = film.servers[film.server]?.episodes || [];
        if (!episodes.length) {
          await send(chatId, '😕 Server này chưa có tập.');
          return;
        }
        await sendEpisode(chatId, film, episodes.length - 1);
        return;
      }
      case 'server': {
        if (!film) {
          await send(chatId, NO_FILM);
          return;
        }
        const index = command.index - 1;
        if (!film.servers[index]) {
          await send(chatId, `📡 Chỉ có server 1–${film.servers.length}:\n${serverList(film)}`);
          return;
        }
        const nextFilm = { ...film, server: index };
        await memory.saveChat(chatId, { ...state, film: nextFilm });
        await send(chatId, `📡 Đã đổi sang server ${film.servers[index].name}.\n\n${episodeGuide(nextFilm)}`);
        return;
      }
      default:
        await send(chatId, HELP);
    }
  }

  async function handleUpdate(update) {
    const event = update?.event_name ? update : update?.result;
    const message = event?.message;
    const chatId = message?.chat?.id;
    if (!chatId || message?.from?.is_bot) return;
    // Trong nhóm, bot sẽ coi mọi tin nhắn là từ khóa tìm phim, nên chỉ trả lời chat riêng.
    if (message.chat.chat_type && message.chat.chat_type !== 'PRIVATE') return;

    try {
      if (event.event_name === 'message.text.received') {
        await handleText(chatId, message.text);
      } else if (event.event_name !== 'message.unsupported.received') {
        await send(chatId, '✍️ Bot chỉ đọc tin nhắn chữ. Gõ tên phim để tìm.');
      }
    } catch (error) {
      console.error('Zalo: lỗi xử lý tin nhắn:', error.message);
      try {
        await send(chatId, '⚠️ Có lỗi khi xử lý. Thử lại sau.');
      } catch {
        // Không gửi được cả tin báo lỗi thì thôi.
      }
    }
  }

  return { handleUpdate };
}

module.exports = {
  HELP,
  parseCommand,
  findEpisode,
  episodeNumber,
  searchListText,
  detailText,
  createZaloBot,
};
