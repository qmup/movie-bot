'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_WATCH_BASE,
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

test('buildWatchUrl bọc streamc qua trang bounce để có Referer', () => {
  const url = buildWatchUrl(EMBED, { baseUrl: 'https://example.test/watch.html' });
  assert.equal(
    url,
    'https://example.test/watch.html?h=7eeff26d5bbd97df157b7aee1b6425e2',
  );
});

test('buildWatchUrl mặc định dùng jsDelivr public/watch.html', () => {
  const previous = process.env.WATCH_BASE_URL;
  delete process.env.WATCH_BASE_URL;
  try {
    assert.equal(
      buildWatchUrl(EMBED),
      `${DEFAULT_WATCH_BASE}?h=7eeff26d5bbd97df157b7aee1b6425e2`,
    );
  } finally {
    if (previous === undefined) delete process.env.WATCH_BASE_URL;
    else process.env.WATCH_BASE_URL = previous;
  }
});

test('buildWatchUrl fallback sang trang phim Nguonc khi không phải streamc', () => {
  assert.equal(
    buildWatchUrl('https://other.cdn/play/1', {
      baseUrl: 'https://example.test/watch.html',
      filmSlug: 'loki-than-lua-loc-phan-2',
    }),
    'https://phim.nguonc.com/phim/loki-than-lua-loc-phan-2',
  );
  assert.equal(filmPageUrl('hoa-thien-cot'), 'https://phim.nguonc.com/phim/hoa-thien-cot');
});
