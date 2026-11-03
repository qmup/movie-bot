'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractStreamcHash,
  filmPageUrl,
  buildWatchUrl,
} = require('../src/watchUrl');

const EMBED =
  'https://embed.streamc.xyz/embed.php?hash=7eeff26d5bbd97df157b7aee1b6425e2';

test('extractStreamcHash đọc hash từ URL embed', () => {
  assert.equal(
    extractStreamcHash(EMBED),
    '7eeff26d5bbd97df157b7aee1b6425e2',
  );
  assert.equal(extractStreamcHash('https://evil.test/x'), null);
  assert.equal(extractStreamcHash(''), null);
});

test('buildWatchUrl bọc streamc qua trang bounce khi có WATCH_BASE_URL', () => {
  const url = buildWatchUrl(EMBED, { baseUrl: 'https://example.test/watch.html' });
  assert.equal(
    url,
    'https://example.test/watch.html?h=7eeff26d5bbd97df157b7aee1b6425e2',
  );
});

test('buildWatchUrl mặc định dùng trang phim Nguonc (tránh 403 thiếu Referer)', () => {
  const previous = process.env.WATCH_BASE_URL;
  delete process.env.WATCH_BASE_URL;
  try {
    assert.equal(
      buildWatchUrl(EMBED, { filmSlug: 'loki-than-lua-loc-phan-2' }),
      'https://phim.nguonc.com/phim/loki-than-lua-loc-phan-2',
    );
    assert.equal(buildWatchUrl(EMBED), null);
  } finally {
    if (previous === undefined) delete process.env.WATCH_BASE_URL;
    else process.env.WATCH_BASE_URL = previous;
  }
});

test('filmPageUrl và fallback non-streamc', () => {
  assert.equal(
    buildWatchUrl('https://other.cdn/play/1', {
      baseUrl: 'https://example.test/watch.html',
      filmSlug: 'loki-than-lua-loc-phan-2',
    }),
    'https://phim.nguonc.com/phim/loki-than-lua-loc-phan-2',
  );
  assert.equal(filmPageUrl('hoa-thien-cot'), 'https://phim.nguonc.com/phim/hoa-thien-cot');
});
