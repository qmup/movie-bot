'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildKeywordVariants } = require('../src/search');

test('spiderman thêm biến thể spider man', () => {
  const variants = buildKeywordVariants('spiderman');
  assert.equal(variants[0], 'spiderman');
  assert.ok(variants.includes('spider man'));
});

test('SpiderMan tách camelCase thành Spider Man', () => {
  const variants = buildKeywordVariants('SpiderMan');
  assert.equal(variants[0], 'SpiderMan');
  assert.ok(variants.includes('Spider Man'));
});

test('truy vấn nhiều từ giữ nguyên, không sinh rác', () => {
  assert.deepEqual(buildKeywordVariants('spider man'), ['spider man']);
  assert.deepEqual(buildKeywordVariants('Hoa Thiên Cốt'), ['Hoa Thiên Cốt']);
});

test('gộp khoảng trắng thừa và bỏ trùng không phân biệt hoa thường', () => {
  assert.deepEqual(buildKeywordVariants('  spider   man  '), ['spider man']);
  const variants = buildKeywordVariants('BatMan');
  assert.equal(variants[0], 'BatMan');
  assert.ok(variants.includes('Bat Man'));
  assert.equal(variants.filter((v) => v.toLowerCase() === 'bat man').length, 1);
});

test('các đuôi tiêu đề tiếng Anh phổ biến', () => {
  assert.ok(buildKeywordVariants('batman').includes('bat man'));
  assert.ok(buildKeywordVariants('wonderwoman').includes('wonder woman'));
  assert.ok(buildKeywordVariants('starwars').includes('star wars'));
  assert.ok(buildKeywordVariants('jurassicpark').includes('jurassic park'));
});
