const test = require('node:test');
const assert = require('node:assert/strict');
const film = require('../fixtures/film-hoa-thien-cot.json');
const { layoutEpisodeButtons } = require('../src/episodes');
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
  watchCallback,
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

test('callback_data chỉ là id phiên và chỉ số, không quá 64 byte', () => {
  const id = rememberFilm(film.movie);
  const session = recall(id);
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
    watchCallback(id, 0, 0),
    watchCallback(id, 0, 49),
    watchCallback(id, 12, 9999),
  ];

  for (const data of samples) assertShort(data);

  session.servers.forEach((server, serverIndex) => {
    server.episodes.forEach((episode, episodeIndex) => {
      const data = watchCallback(id, serverIndex, episodeIndex);
      assertShort(data);
      assert.equal(data.includes(episode.embed), false);
      const parsed = parseCallback(data);
      assert.equal(parsed.type, 'watch');
      assert.equal(parsed.id, id);
      assert.equal(parsed.server, serverIndex);
      assert.equal(parsed.episode, episodeIndex);
      assert.equal(recall(parsed.id).servers[parsed.server].episodes[parsed.episode].embed, episode.embed);
    });
  });

  assert.equal(parseCallback(`${'x'.repeat(65)}`), null);
  assert.equal(watchCallback(id, 0, 49), `w:${id}:0:49`);
});

test('nút hết hạn sau khoảng 2 giờ và tập được chia 5 nút một hàng, 20 tập một trang', () => {
  const createdAt = Date.now() - TTL_MS - 1;
  const id = remember({ type: 'film', slug: 'hoa-thien-cot', servers: [] }, createdAt);
  assert.equal(recall(id), null);

  const fresh = remember({ type: 'search', keyword: 'hoa' }, Date.now());
  assert.equal(recall(fresh).keyword, 'hoa');

  const episodes = film.movie.episodes[0].items;
  const first = layoutEpisodeButtons(episodes, 0);
  assert.equal(first.totalPages, 3);
  assert.equal(first.rows.length, 5);
  assert.deepEqual(
    first.rows.slice(0, 4).map((row) => row.length),
    [5, 5, 5, 5],
  );
  assert.equal(first.rows[0][0].label, '1');
  assert.equal(first.rows[0][0].episodeIndex, 0);
  assert.equal(first.rows[3][4].label, '20');
  assert.equal(first.rows[4].at(-1).label, 'Trang sau »');

  const last = layoutEpisodeButtons(episodes, 2);
  assert.equal(last.rows[0][0].episodeIndex, 40);
  assert.equal(last.rows[1][4].label, '50');
  assert.equal(last.rows.at(-1)[0].label, '« Trang trước');

  const single = layoutEpisodeButtons([{ name: 'FULL', embed: 'https://example.test/a' }], 0);
  assert.deepEqual(single.rows, [[{ label: 'Xem phim', episodeIndex: 0 }]]);
});
