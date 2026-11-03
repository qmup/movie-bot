const crypto = require('crypto');

const TTL_MS = 2 * 60 * 60 * 1000;
const CALLBACK_MAX_BYTES = 64;
const EXPIRED_MESSAGE = 'Phiên đã hết hạn. Hãy tìm lại phim.';

const store = new Map();

function prune(now = Date.now()) {
  for (const [id, row] of store) {
    if (now - row.createdAt >= TTL_MS) store.delete(id);
  }
}

function remember(data, createdAt = Date.now()) {
  prune();
  const rest = { ...data };
  delete rest.id;
  delete rest.createdAt;

  let id = '';
  do {
    id = crypto.randomBytes(4).toString('hex');
  } while (store.has(id));

  store.set(id, { ...rest, id, createdAt });
  return id;
}

function recall(id, now = Date.now()) {
  const row = store.get(id);
  if (!row) return null;
  if (now - row.createdAt >= TTL_MS) {
    store.delete(id);
    return null;
  }
  return row;
}

function rememberSearch(keyword, page, items) {
  return remember({
    type: 'search',
    keyword,
    page,
    slugs: (items || []).map((item) => item.slug),
  });
}

function rememberFilm(movie) {
  return remember({
    type: 'film',
    slug: movie.slug,
    movie: {
      name: movie.name,
      original_name: movie.original_name,
      slug: movie.slug,
      year: movie.year,
      description: movie.description,
      current_episode: movie.current_episode,
      time: movie.time,
      quality: movie.quality,
      language: movie.language,
      director: movie.director,
      casts: movie.casts,
      category: movie.category,
      poster_url: movie.poster_url,
      thumb_url: movie.thumb_url,
    },
    servers: (movie.episodes || []).map((server) => ({
      name: server.server_name,
      episodes: (server.items || []).map((item) => ({
        name: item.name,
        embed: item.embed,
      })),
    })),
  });
}

function pack(parts) {
  const data = parts.map((part) => String(part)).join(':');
  const size = Buffer.byteLength(data);
  if (size > CALLBACK_MAX_BYTES) {
    throw new Error(`callback_data vượt 64 byte (${size})`);
  }
  return data;
}

function searchPageCallback(id, page) {
  return pack(['q', id, page]);
}

function detailCallback(id, index) {
  return pack(['d', id, index]);
}

function serverCallback(id, serverIndex) {
  return pack(['s', id, serverIndex]);
}

function episodePageCallback(id, serverIndex, page) {
  return pack(['e', id, serverIndex, page]);
}

function parseCallback(data) {
  if (typeof data !== 'string' || Buffer.byteLength(data) > CALLBACK_MAX_BYTES) {
    return null;
  }
  const parts = data.split(':');
  const id = parts[1];
  if (!/^[0-9a-f]{8}$/.test(id || '')) return null;

  const nums = parts.slice(2).map((part) => (/^\d+$/.test(part) ? Number(part) : Number.NaN));
  if (nums.some((num) => !Number.isSafeInteger(num))) return null;

  switch (parts[0]) {
    case 'q':
      if (parts.length !== 3 || nums[0] < 1) return null;
      return { type: 'search', id, page: nums[0] };
    case 'd':
      if (parts.length !== 3) return null;
      return { type: 'detail', id, index: nums[0] };
    case 's':
      if (parts.length !== 3) return null;
      return { type: 'server', id, server: nums[0] };
    case 'e':
      if (parts.length !== 4) return null;
      return { type: 'episodes', id, server: nums[0], page: nums[1] };
    default:
      return null;
  }
}

module.exports = {
  TTL_MS,
  CALLBACK_MAX_BYTES,
  EXPIRED_MESSAGE,
  remember,
  recall,
  rememberSearch,
  rememberFilm,
  searchPageCallback,
  detailCallback,
  serverCallback,
  episodePageCallback,
  parseCallback,
};
