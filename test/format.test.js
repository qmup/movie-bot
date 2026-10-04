const test = require('node:test');
const assert = require('node:assert/strict');
const search = require('../fixtures/search-regeneration.json');
const film = require('../fixtures/film-hoa-thien-cot.json');
const {
  PHOTO_CAPTION_LIMIT,
  stripHtml,
  escapeHtml,
  buildSearchCaption,
  buildDetailCaption,
} = require('../src/format');

test('stripHtml bỏ thẻ và giải mã entity', () => {
  const raw = film.movie.description;
  assert.match(raw, /<p>/);
  const plain = stripHtml(raw);
  assert.doesNotMatch(plain, /<[^>]+>/);
  assert.match(plain, /^Hoa Thiên Cốt/);

  const searchPlain = stripHtml(search.items[0].description);
  assert.doesNotMatch(searchPlain, /<[^>]+>/);
  assert.match(searchPlain, /^Khi bị các thế lực/);

  assert.equal(stripHtml('<p>Tom &amp; Jerry<br>tập 1</p>'), 'Tom & Jerry\ntập 1');
  assert.equal(escapeHtml('A & B <C>'), 'A &amp; B &lt;C&gt;');
  assert.equal(escapeHtml(stripHtml('<p>a &amp; b</p>')), 'a &amp; b');
});

test('caption chi tiết dùng năm phát hành và vừa 1024 ký tự', () => {
  const caption = buildDetailCaption(film.movie);
  assert.ok(caption.length <= PHOTO_CAPTION_LIMIT);
  assert.match(caption, /<b>Hoa Thiên Cốt<\/b>/);
  assert.match(caption, /<i>The Journey Of Flower<\/i>/);
  assert.match(caption, /Năm: 2015/);
  assert.match(caption, /Trạng thái: Hoàn tất \(50\/50\)/);
  assert.match(caption, /Đạo diễn: Cao Lâm Báo/);
  assert.match(caption, /Diễn viên: Hoắc Kiến Hoa/);
  assert.match(caption, /Định dạng: Phim bộ/);
  assert.match(caption, /Thể loại: Cổ Trang, Tình Cảm/);
  assert.match(caption, /Quốc gia: Trung Quốc/);
  assert.match(caption, /Hoa Thiên Cốt: Là chuyện tình/);
  assert.doesNotMatch(caption, /<p>/);
  assert.doesNotMatch(caption, /2023-08-11/);
  assert.doesNotMatch(caption, /2024-04-29/);

  for (const item of search.items) {
    const card = buildSearchCaption(item);
    assert.ok(card.length <= PHOTO_CAPTION_LIMIT);
    assert.match(card, new RegExp(`Năm: ${item.year}`));
    assert.match(card, /Tập hiện tại:/);
    assert.doesNotMatch(card, /created/);
    assert.equal(card.includes(item.created.slice(0, 10)), false);
  }
});

test('caption dài bị cắt còn tối đa 1024 ký tự', () => {
  const huge = {
    ...film.movie,
    name: 'Phim & <đặc biệt>',
    description: `<p>${'Nội dung rất dài. '.repeat(400)}</p><script>alert(1)</script>`,
    casts: `Diễn viên & bạn diễn <${'A'.repeat(1500)}>`,
    director: `Đạo diễn ${'B'.repeat(800)}`,
  };
  const caption = buildDetailCaption(huge, { serverName: 'Vietsub #1' });
  assert.ok(caption.length <= PHOTO_CAPTION_LIMIT);
  assert.match(caption, /…/);
  assert.match(caption, /Năm: 2015/);
  assert.match(caption, /Phim &amp; &lt;đặc biệt&gt;/);
  assert.match(caption, /Server: Vietsub #1/);
  assert.doesNotMatch(caption, /<p>/);
  assert.doesNotMatch(caption, /<script>/);
  assert.doesNotMatch(caption, /2023-08-11/);
});
