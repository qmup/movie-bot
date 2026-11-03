'use strict';

const NGUONC_SITE = 'https://phim.nguonc.com';

const STREAMC_HASH =
  /^https?:\/\/(?:embed\.)?streamc\.xyz\/embed\.php\?hash=([a-f0-9]{16,64})(?:&.*)?$/i;

function trimBase(value) {
  return String(value || '').trim().replace(/[?#].*$/, '').replace(/\/+$/, '');
}

function resolveWatchBase(baseUrl) {
  return trimBase(baseUrl ?? process.env.WATCH_BASE_URL);
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
 *
 * Cloudflare của streamc.xyz trả 403 khi request không có header Referer
 * (đúng hành vi nút URL trên Telegram). Không mở thẳng embed.
 *
 * - Nếu WATCH_BASE_URL trỏ tới bản public/watch.html tự host → bounce theo hash.
 * - Không thì dùng trang phim Nguonc (iframe hợp lệ, có Referer).
 */
function buildWatchUrl(embed, options = {}) {
  const raw = typeof embed === 'string' ? embed.trim() : '';
  if (!raw) return null;

  const base = resolveWatchBase(options.baseUrl);
  const hash = extractStreamcHash(raw);
  if (base && hash) {
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

  // Không có slug và không có bounce: tránh trả embed thô (Telegram → 403).
  return null;
}

module.exports = {
  NGUONC_SITE,
  extractStreamcHash,
  filmPageUrl,
  buildWatchUrl,
  resolveWatchBase,
};
