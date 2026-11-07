const test = require('node:test');
const assert = require('node:assert/strict');
const sessions = require('../src/session');
const {
  parseCommand,
  findEpisode,
  episodeNumber,
  createZaloBot,
} = require('../src/zaloBot');

function textUpdate(chatId, text, chatType = 'PRIVATE') {
  return {
    event_name: 'message.text.received',
    message: {
      message_id: 'm1',
      date: Date.now(),
      message_type: 'CHAT_TEXT',
      from: { id: chatId, display_name: 'Test', is_bot: false },
      chat: { id: chatId, chat_type: chatType },
      text,
    },
  };
}

function fakeClient() {
  const sent = [];
  return {
    sent,
    async sendMessage(chatId, text) {
      sent.push({ kind: 'text', chatId, text });
    },
    async sendPhoto(chatId, photo, caption) {
      sent.push({ kind: 'photo', chatId, photo, caption });
    },
    async sendTyping() {},
  };
}

function longSeries() {
  return {
    status: 'success',
    movie: {
      name: 'One Piece',
      original_name: 'Đảo Hải Tặc',
      slug: 'one-piece',
      year: 1999,
      current_episode: 'Tập 1180',
      poster_url: 'https://img.example/one-piece.jpg',
      description: '<p>Luffy ra khơi.</p>',
      episodes: [
        {
          server_name: 'Vietsub #1',
          items: Array.from({ length: 1180 }, (_, index) => ({
            name: String(index + 1),
            embed: `https://embed.streamc.xyz/embed.php?hash=${String(index + 1).padStart(32, 'a')}`,
          })),
        },
        {
          server_name: 'Thuyết minh',
          items: [{ name: '1', embed: 'https://embed.streamc.xyz/embed.php?hash=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }],
        },
      ],
    },
  };
}

function fakeApi() {
  const calls = [];
  return {
    calls,
    async searchFilms(keyword, page) {
      calls.push({ keyword, page });
      if (keyword === 'one piece') {
        return {
          status: 'success',
          paginate: { current_page: page, total_page: 3, total_items: 25 },
          items: [
            { name: 'One Piece', slug: 'one-piece', year: 1999, current_episode: 'Tập 1180' },
            { name: 'One Piece Film Red', slug: 'one-piece-red', year: 2022, current_episode: 'FULL' },
          ],
        };
      }
      if (keyword === 'hoa thien cot') {
        return {
          status: 'success',
          paginate: { current_page: 1, total_page: 1, total_items: 1 },
          items: [{ name: 'Hoa Thiên Cốt', slug: 'hoa-thien-cot' }],
        };
      }
      return { status: 'success', paginate: { current_page: 1, total_page: 1 }, items: [] };
    },
    async getFilm(slug) {
      if (slug === 'one-piece') return longSeries();
      return {
        status: 'success',
        movie: {
          name: 'Hoa Thiên Cốt',
          slug,
          poster_url: 'https://img.example/htc.jpg',
          episodes: [{ server_name: 'Vietsub', items: [{ name: 'FULL', embed: 'https://ok.test/full' }] }],
        },
      };
    },
  };
}

test('đọc lệnh chữ của Zalo, kể cả gõ không dấu', () => {
  assert.deepEqual(parseCommand('one piece'), { type: 'search', keyword: 'one piece' });
  assert.deepEqual(parseCommand('  2 '), { type: 'number', value: 2 });
  assert.deepEqual(parseCommand('Tiếp'), { type: 'next' });
  assert.deepEqual(parseCommand('tiep'), { type: 'next' });
  assert.deepEqual(parseCommand('trước'), { type: 'prev' });
  assert.deepEqual(parseCommand('trang 3'), { type: 'page', page: 3 });
  assert.deepEqual(parseCommand('Tập 1180'), { type: 'episode', number: 1180 });
  assert.deepEqual(parseCommand('server 2'), { type: 'server', index: 2 });
  assert.deepEqual(parseCommand('Mới nhất'), { type: 'latest' });
  assert.deepEqual(parseCommand('ds'), { type: 'list' });
  assert.deepEqual(parseCommand('/start'), { type: 'help' });
  assert.deepEqual(parseCommand('tìm 1917'), { type: 'search', keyword: '1917' });
  assert.deepEqual(parseCommand('Tiếp Bước Anh'), { type: 'search', keyword: 'Tiếp Bước Anh' });
});

test('tìm tập theo tên số trước, rồi mới theo thứ tự', () => {
  const episodes = [{ name: 'Tập 0' }, { name: 'Tập 1' }, { name: 'Tập 2' }, { name: 'Đặc biệt' }];
  assert.equal(episodeNumber('Tập 12'), 12);
  assert.equal(episodeNumber('12-13'), null);
  assert.equal(findEpisode(episodes, 1), 1);
  assert.equal(findEpisode(episodes, 2), 2);
  assert.equal(findEpisode(episodes, 4), 3);
  assert.equal(findEpisode(episodes, 9), -1);
});

test('tìm phim, chọn số, lấy link tập 1180 và đổi server', async () => {
  const client = fakeClient();
  const api = fakeApi();
  const bot = createZaloBot({ client, api, memory: sessions });
  const chat = 'chat-one-piece';

  await bot.handleUpdate(textUpdate(chat, 'one piece'));
  const list = client.sent.at(-1);
  assert.equal(list.kind, 'text');
  assert.match(list.text, /trang 1\/3/);
  assert.match(list.text, /^1\. One Piece \(1999\) · Tập 1180$/m);
  assert.match(list.text, /^2\. One Piece Film Red/m);
  assert.match(list.text, /"tiếp" sang trang sau/);

  await bot.handleUpdate(textUpdate(chat, 'tiếp'));
  assert.deepEqual(api.calls.at(-1), { keyword: 'one piece', page: 2 });

  await bot.handleUpdate(textUpdate(chat, '1'));
  const [photo, guide] = client.sent.slice(-2);
  assert.equal(photo.kind, 'photo');
  assert.equal(photo.photo, 'https://img.example/one-piece.jpg');
  assert.match(photo.caption, /^🎬 One Piece/);
  assert.match(photo.caption, /Luffy ra khơi\./);
  assert.ok(photo.caption.length <= 2000);
  assert.match(guide.text, /1180 tập \(1 → 1180\)/);
  assert.match(guide.text, /2\. Thuyết minh/);

  const previous = process.env.WATCH_BASE_URL;
  process.env.WATCH_BASE_URL = 'https://watch.example/watch.html';
  try {
    await bot.handleUpdate(textUpdate(chat, '1180'));
    const link = client.sent.at(-1).text;
    assert.match(link, /^▶️ One Piece · Tập 1180$/m);
    assert.match(link, /^https:\/\/watch\.example\/watch\.html\?h=a+1180$/m);
    assert.doesNotMatch(link, /Tập tiếp theo/);

    await bot.handleUpdate(textUpdate(chat, 'tập 5'));
    assert.match(client.sent.at(-1).text, /Tập tiếp theo: gõ 6/);

    await bot.handleUpdate(textUpdate(chat, '9999'));
    assert.match(client.sent.at(-1).text, /Không có tập 9999\. Phim có 1180 tập/);

    await bot.handleUpdate(textUpdate(chat, 'server 2'));
    assert.match(client.sent.at(-1).text, /Đã đổi sang server Thuyết minh/);
    assert.match(client.sent.at(-1).text, /▶️ Xem phim: https:\/\/watch\.example\/watch\.html\?h=b+/);
  } finally {
    if (previous === undefined) delete process.env.WATCH_BASE_URL;
    else process.env.WATCH_BASE_URL = previous;
  }

  await bot.handleUpdate(textUpdate(chat, 'ds'));
  assert.deepEqual(api.calls.at(-1), { keyword: 'one piece', page: 2 });
  assert.match(client.sent.at(-1).text, /Gõ số 1–2 để xem chi tiết/);
});

test('một kết quả thì mở luôn chi tiết; nhóm và tin của bot bị bỏ qua', async () => {
  const client = fakeClient();
  const bot = createZaloBot({ client, api: fakeApi(), memory: sessions });

  await bot.handleUpdate(textUpdate('chat-htc', 'hoa thien cot'));
  assert.equal(client.sent[0].kind, 'photo');
  assert.match(client.sent[1].text, /^▶️ Xem phim: https:\/\/phim\.nguonc\.com\/phim\/hoa-thien-cot$/);

  await bot.handleUpdate(textUpdate('chat-htc', 'không có phim này'));
  assert.match(client.sent.at(-1).text, /Không tìm thấy phim cho “không có phim này”/);

  const before = client.sent.length;
  await bot.handleUpdate(textUpdate('group-1', 'one piece', 'GROUP'));
  const fromBot = textUpdate('chat-htc', 'one piece');
  fromBot.message.from.is_bot = true;
  await bot.handleUpdate(fromBot);
  await bot.handleUpdate({});
  assert.equal(client.sent.length, before);

  await bot.handleUpdate(textUpdate('chat-new', 'tiếp'));
  assert.match(client.sent.at(-1).text, /Chưa có danh sách/);
});

test('ảnh lỗi thì vẫn gửi chi tiết bằng chữ', async () => {
  const client = fakeClient();
  client.sendPhoto = async () => {
    throw new Error('Zalo sendPhoto: bad photo');
  };
  const bot = createZaloBot({ client, api: fakeApi(), memory: sessions });
  const originalError = console.error;
  console.error = () => {};
  try {
    await bot.handleUpdate(textUpdate('chat-photo', 'hoa thien cot'));
  } finally {
    console.error = originalError;
  }
  assert.equal(client.sent.length, 2);
  assert.match(client.sent[0].text, /^🎬 Hoa Thiên Cốt/);
});
