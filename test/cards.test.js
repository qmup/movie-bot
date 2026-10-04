'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  posterUrls,
  resolveCardImage,
  prefetchCardImages,
  sendCardsInOrder,
} = require('../src/cards');

describe('posterUrls', () => {
  it('keeps unique poster then thumb', () => {
    assert.deepEqual(
      posterUrls({
        poster_url: 'https://img.example/a.jpg',
        thumb_url: 'https://img.example/b.jpg',
      }),
      ['https://img.example/a.jpg', 'https://img.example/b.jpg'],
    );
    assert.deepEqual(
      posterUrls({
        poster_url: 'https://img.example/same.jpg',
        thumb_url: 'https://img.example/same.jpg',
      }),
      ['https://img.example/same.jpg'],
    );
    assert.deepEqual(posterUrls({}), []);
  });
});

describe('resolveCardImage', () => {
  it('falls back to thumb when poster fails', async () => {
    const calls = [];
    const download = async (url) => {
      calls.push(url);
      if (url.includes('bad')) throw new Error('fail');
      return { source: Buffer.from('ok'), filename: 'poster.jpg' };
    };

    const image = await resolveCardImage({
      poster_url: 'https://img.example/bad.jpg',
      thumb_url: 'https://img.example/good.jpg',
    }, download);

    assert.deepEqual(calls, [
      'https://img.example/bad.jpg',
      'https://img.example/good.jpg',
    ]);
    assert.equal(image.filename, 'poster.jpg');
  });

  it('returns null when every URL fails', async () => {
    const image = await resolveCardImage(
      { poster_url: 'https://img.example/a.jpg' },
      async () => {
        throw new Error('down');
      },
    );
    assert.equal(image, null);
  });
});

describe('prefetch + ordered send', () => {
  it('starts all downloads immediately and sends in order', async () => {
    const started = [];
    const sent = [];
    let releaseSecond;
    let releaseFirst;

    const secondReady = new Promise((resolve) => {
      releaseSecond = resolve;
    });
    const firstReady = new Promise((resolve) => {
      releaseFirst = resolve;
    });

    const download = async (url) => {
      started.push(url);
      if (url.endsWith('1.jpg')) {
        await firstReady;
        return { source: Buffer.from('1'), filename: '1.jpg' };
      }
      await secondReady;
      return { source: Buffer.from('2'), filename: '2.jpg' };
    };

    const items = [
      { poster_url: 'https://img.example/1.jpg' },
      { poster_url: 'https://img.example/2.jpg' },
    ];

    const imagePromises = prefetchCardImages(items, download);
    // Both downloads must be in flight before any send completes.
    await Promise.resolve();
    assert.deepEqual(started, [
      'https://img.example/1.jpg',
      'https://img.example/2.jpg',
    ]);

    // Finish card 2 first; ordered send must still wait for card 1.
    releaseSecond();
    await Promise.resolve();

    const sending = sendCardsInOrder(imagePromises, async (index, image) => {
      sent.push({ index, filename: image?.filename || null });
    });

    assert.deepEqual(sent, []);
    releaseFirst();
    await sending;

    assert.deepEqual(sent, [
      { index: 0, filename: '1.jpg' },
      { index: 1, filename: '2.jpg' },
    ]);
  });

  it('tolerates a failed image and still sends later cards', async () => {
    const download = async (url) => {
      if (url.includes('fail')) throw new Error('nope');
      return { source: Buffer.from('ok'), filename: 'ok.jpg' };
    };

    const items = [
      { poster_url: 'https://img.example/fail.jpg' },
      { poster_url: 'https://img.example/ok.jpg' },
    ];
    const imagePromises = prefetchCardImages(items, download);
    const sent = [];

    await sendCardsInOrder(imagePromises, async (index, image) => {
      sent.push({ index, hasImage: Boolean(image) });
    });

    assert.deepEqual(sent, [
      { index: 0, hasImage: false },
      { index: 1, hasImage: true },
    ]);
  });
});
