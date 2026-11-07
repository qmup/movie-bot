const test = require('node:test');
const assert = require('node:assert/strict');
const film = require('../fixtures/film-hoa-thien-cot.json');
const { layoutEpisodeButtons, layoutEpisodeRanges, isValidEmbed } = require('../src/episodes');
const {
  CALLBACK_MAX_BYTES,
  TTL_MS,
  remember,
  recall,
  rememberFilm,
  searchPageCallback,
  detailCallback,
  serverCallback,
  episodePageCallback,
  episodeRangesCallback,
  parseCallback,
} = require('../src/session');

function assertShort(data) {
  assert.equal(typeof data, 'string');
  assert.ok(Buffer.byteLength(data) <= CALLBACK_MAX_BYTES);
  assert.ok(Buffer.byteLength(data) <= 64);
  assert.equal(data.includes('http'), false);
  assert.equal(data.includes('embed'), false);
  assert.equal(data.includes('hoa-thien-cot'), false);
}

test('callback_data chỉ là id phiên và chỉ số, không quá 64 byte', async () => {
  const id = await rememberFilm(film.movie);
  const session = await recall(id);
  assert.equal(session.slug, 'hoa-thien-cot');
  assert.equal(session.servers[0].episodes[0].embed.startsWith('https://'), true);

  const samples = [
    searchPageCallback(id, 1),
    searchPageCallback(id, 99),
    detailCallback(id, 0),
    detailCallback(id, 9),
    serverCallback(id, 0),
    episodePageCallback(id, 0, 0),
    episodePageCallback(id, 0, 2),
    episodeRangesCallback(id, 0, 58),
  ];

  for (const data of samples) assertShort(data);

  assert.equal(parseCallback(searchPageCallback(id, 2)).type, 'search');
  assert.equal(parseCallback(detailCallback(id, 1)).type, 'detail');
  assert.equal(parseCallback(serverCallback(id, 0)).type, 'server');
  assert.equal(parseCallback(episodePageCallback(id, 0, 1)).type, 'episodes');
  assert.equal(parseCallback(episodeRangesCallback(id, 0, 12)).type, 'ranges');
  assert.equal(parseCallback(episodeRangesCallback(id, 0, 12)).page, 12);
  assert.equal(episodeRangesCallback(id, 0, 12), `g:${id}:0:12`);
  assert.equal(parseCallback(`w:${id}:0:0`), null);
  assert.equal(parseCallback(`${'x'.repeat(65)}`), null);
  assert.equal(episodePageCallback(id, 0, 2), `e:${id}:0:2`);
});

test('nút hết hạn sau khoảng 2 giờ và tập được chia 5 nút một hàng, 20 tập một trang', async () => {
  const createdAt = Date.now() - TTL_MS - 1;
  const id = await remember({ type: 'film', slug: 'hoa-thien-cot', servers: [] }, createdAt);
  assert.equal(await recall(id), null);

  const fresh = await remember({ type: 'search', keyword: 'hoa' }, Date.now());
  assert.equal((await recall(fresh)).keyword, 'hoa');

  const episodes = film.movie.episodes[0].items;
  const filmPage = 'https://phim.nguonc.com/phim/hoa-thien-cot';
  const first = layoutEpisodeButtons(episodes, 0, { filmSlug: 'hoa-thien-cot' });
  assert.equal(first.totalPages, 3);
  assert.equal(first.rows.length, 5);
  assert.deepEqual(
    first.rows.slice(0, 4).map((row) => row.length),
    [5, 5, 5, 5],
  );
  assert.equal(first.rows[0][0].label, '1');
  assert.equal(first.rows[0][0].episodeIndex, 0);
  assert.equal(first.rows[0][0].url, filmPage);
  assert.equal(first.rows[3][4].label, '20');
  assert.equal(first.rows[3][4].url, filmPage);
  assert.equal(first.rows[4].at(-1).label, 'Trang sau »');
  assert.equal('url' in first.rows[4].at(-1), false);
  assert.equal('page' in first.rows[4].at(-1), true);

  const last = layoutEpisodeButtons(episodes, 2, { filmSlug: 'hoa-thien-cot' });
  assert.equal(last.rows[0][0].episodeIndex, 40);
  assert.equal(last.rows[0][0].url, filmPage);
  assert.equal(last.rows[1][4].label, '50');
  assert.equal(last.rows.at(-1)[0].label, '« Trang trước');

  const previous = process.env.WATCH_BASE_URL;
  process.env.WATCH_BASE_URL = 'https://pages.example/watch.html';
  try {
    const bounced = layoutEpisodeButtons(episodes.slice(0, 1), 0, { filmSlug: 'hoa-thien-cot' });
    assert.match(bounced.rows[0][0].url, /^https:\/\/pages\.example\/watch\.html\?h=[a-f0-9]+$/);
  } finally {
    if (previous === undefined) delete process.env.WATCH_BASE_URL;
    else process.env.WATCH_BASE_URL = previous;
  }

  const single = layoutEpisodeButtons(
    [{ name: 'FULL', embed: 'https://example.test/a' }],
    0,
    { filmSlug: 'full-phim' },
  );
  assert.deepEqual(single.rows, [[{
    label: '▶️ Xem phim',
    episodeIndex: 0,
    url: 'https://phim.nguonc.com/phim/full-phim',
  }]]);

  const broken = layoutEpisodeButtons([
    { name: '1', embed: 'https://ok.test/1' },
    { name: '2', embed: 'not-a-url' },
    { name: '3', embed: '' },
    { name: '4', embed: 'http://ok.test/4' },
  ], 0, { filmSlug: 'hoa-thien-cot' });
  assert.equal(broken.rows[0][0].url, filmPage);
  assert.equal(broken.rows[0][1].url, null);
  assert.equal(broken.rows[0][2].url, null);
  assert.equal(broken.rows[0][3].url, filmPage);
  assert.equal(isValidEmbed('https://x'), true);
  assert.equal(isValidEmbed('ftp://x'), false);
  assert.equal(isValidEmbed(null), false);
});

test('phim rất nhiều tập nhảy tới cuối và chọn theo khoảng tập', () => {
  const episodes = Array.from({ length: 1180 }, (_, index) => ({
    name: String(index + 1),
    embed: 'https://example.test/e',
  }));

  const first = layoutEpisodeButtons(episodes, 0, { filmSlug: 'one-piece' });
  assert.equal(first.totalPages, 59);
  assert.deepEqual(
    first.rows[4].map((button) => button.label),
    ['[1–20]', '21–40', '41–60', '61–80', '81–100'],
  );
  assert.equal(first.rows[4][1].page, 1);
  assert.deepEqual(
    first.rows[5].map((button) => button.label),
    ['1/59', '+10', 'Cuối »'],
  );
  assert.equal(first.rows[5][0].ranges, true);
  assert.equal(first.rows[5][0].page, 0);
  assert.equal(first.rows[5][1].page, 10);
  assert.equal(first.rows[5][2].page, 58);
  assert.equal(first.rows[6].at(-1).label, 'Trang sau »');
  assert.equal(first.rows[6].at(-1).page, 1);

  const nearEnd = layoutEpisodeButtons(episodes, 55, { filmSlug: 'one-piece' });
  assert.equal(nearEnd.rows[0][0].label, '1101');
  assert.deepEqual(
    nearEnd.rows[4].map((button) => button.label),
    ['[1101–1120]', '1121–1140', '1141–1160', '1161–1180'],
  );
  assert.equal(nearEnd.rows[4][3].page, 58);
  assert.deepEqual(
    nearEnd.rows[5].map((button) => button.label),
    ['« Đầu', '-10', '56/59', 'Cuối »'],
  );
  assert.equal(nearEnd.rows[5][1].page, 45);
  assert.equal(nearEnd.rows[5].at(-1).page, 58);

  const middle = layoutEpisodeButtons(episodes, 20, { filmSlug: 'one-piece' });
  assert.deepEqual(
    middle.rows.at(-2).map((button) => button.label),
    ['« Đầu', '-10', '21/59', '+10', 'Cuối »'],
  );
  assert.equal(middle.rows.at(-2)[1].page, 10);
  assert.equal(middle.rows.at(-2)[3].page, 30);

  const last = layoutEpisodeButtons(episodes, 58, { filmSlug: 'one-piece' });
  assert.equal(last.page, 58);
  assert.equal(last.rows[0][0].label, '1161');
  assert.equal(last.rows[3][4].label, '1180');
  assert.equal(last.rows.at(-1)[0].label, '« Trang trước');
  assert.equal(last.rows.at(-2).some((button) => button.label === 'Cuối »'), false);
  assert.equal(last.rows.at(-2).find((button) => button.ranges).label, '59/59');

  const ranges = layoutEpisodeRanges(episodes, 55);
  assert.equal(ranges.rows.length, 5);
  assert.deepEqual(
    ranges.rows[0].map((button) => button.label),
    ['1–100', '101–200', '201–300'],
  );
  assert.equal(ranges.rows[0][1].page, 5);
  assert.equal(ranges.rows[3][2].label, '[1101–1180]');
  assert.equal(ranges.rows[3][2].page, 55);
  assert.deepEqual(ranges.rows.at(-1), [{ label: '« Quay lại', page: 55 }]);
});
