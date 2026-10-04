'use strict';

const { downloadImage } = require('./images');

/**
 * Collect unique poster/thumb URLs for a search/detail item.
 */
function posterUrls(item) {
  return [item?.poster_url, item?.thumb_url].filter(
    (url, index, list) => url && list.indexOf(url) === index,
  );
}

/**
 * Try poster then thumb; return null when every URL fails.
 */
async function resolveCardImage(item, download = downloadImage) {
  const urls = posterUrls(item);
  for (const url of urls) {
    try {
      return await download(url);
    } catch (error) {
      console.error('Không tải được ảnh:', error.message);
    }
  }
  return null;
}

/**
 * Start poster downloads for every item immediately (parallel).
 * Each promise settles to an image or null — failures are tolerated.
 */
function prefetchCardImages(items, download = downloadImage) {
  return items.map((item) => resolveCardImage(item, download));
}

/**
 * Drain image promises in result order: wait only for the next card's
 * image (which may already be ready), then hand it to sendOne.
 * Later downloads keep running while earlier cards are sent.
 */
async function sendCardsInOrder(imagePromises, sendOne) {
  for (let index = 0; index < imagePromises.length; index += 1) {
    const image = await imagePromises[index];
    await sendOne(index, image);
  }
}

module.exports = {
  posterUrls,
  resolveCardImage,
  prefetchCardImages,
  sendCardsInOrder,
};
