'use strict';

const NGUONC_SITE = 'https://phim.nguonc.com';

/**
 * Trang trung gian mặc định (jsDelivr phục vụ public/watch.html trên main).
 * Cloudflare của streamc.xyz trả 403 khi mở embed không có header Referer
 * (đúng hành vi khi bấm URL button trên Telegram). Trang này redirect kèm Referer.
 */
const DEFAULT_WATCH_BASE =
  'https://cdn.jsdelivr.net/gh/qmup/movie-bot@main/public/watch.html';

const STREAMC_HASH =
  /^https?:\/\/(?:embed\.)?streamc\.xyz\/embed\.php\?hash=([a-f0-9]{16,64})(?:&.*)?$/i;

function trimBase(value) {
  return String(value || '').trim().replace(/[?#].*$/, '').replace(/\/+$/, '');
}

function resolveWatchBase(baseUrl) {
  const fromEnv = trimBase(baseUrl ?? process.env.WATCH_BASE_URL);
  return fromEnv || DEFAULT_WATCH_BASE;
}

function extractStreamcHash(embed) {
  if (typeof embed !== 'string') return null;
  const match = embed.trim().match(STREAMC_HASH);
  return match ? match[1].toLowerCase() : null;
}

function filmPageUrl(filmSlug) {
  const slug = String(filmSlug || '').trim();
  if (!slug) return null;
  return `${NGUONC_SITE}/phim/${encodeURIComponent(slug)}`;
}

/**
 * Đổi embed thô thành URL an toàn để mở từ Telegram.
 * Ưu tiên trang bounce (có Referer) → trang phim Nguonc → embed gốc.
 */
function buildWatchUrl(embed, options = {}) {
  const raw = typeof embed === 'string' ? embed.trim() : '';
  if (!raw) return null;

  const base = resolveWatchBase(options.baseUrl);
  const hash = extractStreamcHash(raw);
  if (hash && base) {
    return `${base}?h=${encodeURIComponent(hash)}`;
  }

  if (base && /^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (/(^|\.)streamc\.xyz$/i.test(url.hostname)) {
        return `${base}?u=${encodeURIComponent(url.toString())}`;
      }
    } catch {
      // fall through
    }
  }

  const site = filmPageUrl(options.filmSlug);
  if (site) return site;

  return raw;
}

module.exports = {
  NGUONC_SITE,
  DEFAULT_WATCH_BASE,
  extractStreamcHash,
  filmPageUrl,
  buildWatchUrl,
  resolveWatchBase,
};
