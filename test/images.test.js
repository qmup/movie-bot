const assert = require('node:assert/strict');
const test = require('node:test');
const { imageFilename, downloadImage } = require('../src/images');

test('tên file ảnh lấy từ content-type', () => {
  assert.equal(
    imageFilename('https://img.nguonc.com/images/poster.jpg', 'image/jpeg'),
    'poster.jpg',
  );
  assert.equal(
    imageFilename('https://img.nguonc.com/images/poster.jpg', 'image/webp; charset=binary'),
    'poster.webp',
  );
});

test('tên file ảnh lấy từ đuôi URL khi không có content-type', () => {
  assert.equal(
    imageFilename('https://img.nguonc.com/images/poster.png', ''),
    'poster.png',
  );
});

test('downloadImage từ chối nội dung không phải ảnh', async () => {
  const client = {
    async get() {
      return {
        data: Buffer.from('<html>nope</html>'),
        headers: { 'content-type': 'text/html' },
      };
    },
  };

  await assert.rejects(
    () => downloadImage('https://img.nguonc.com/images/poster.jpg', client),
    /không phải ảnh/,
  );
});
