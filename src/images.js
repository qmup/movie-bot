const axios = require('axios');

const MAX_BYTES = 8 * 1024 * 1024;

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function imageFilename(url, contentType) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  const fromType = EXTENSIONS[type];
  if (fromType) return `poster.${fromType}`;

  try {
    const base = new URL(url).pathname.split('/').pop() || '';
    if (/\.(jpe?g|png|webp|gif)$/i.test(base)) return base;
  } catch {
    // URL lạ thì dùng tên mặc định.
  }
  return 'poster.jpg';
}

async function downloadImage(url, client = axios) {
  const response = await client.get(url, {
    responseType: 'arraybuffer',
    timeout: 20000,
    maxContentLength: MAX_BYTES,
    maxBodyLength: MAX_BYTES,
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: 'https://phim.nguonc.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    },
  });

  const source = Buffer.from(response.data);
  const contentType = response.headers?.['content-type'] || '';
  if (!source.length || source.length > MAX_BYTES) {
    throw new Error('Ảnh rỗng hoặc quá lớn');
  }
  if (contentType && !String(contentType).toLowerCase().startsWith('image/')) {
    throw new Error('Nội dung trả về không phải ảnh');
  }

  return { source, filename: imageFilename(url, contentType) };
}

module.exports = {
  MAX_BYTES,
  imageFilename,
  downloadImage,
};
