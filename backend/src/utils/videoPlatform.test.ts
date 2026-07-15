import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectVideoPlatform } from './videoPlatform.js';

test('detects tiktok from hostname', () => {
  assert.equal(detectVideoPlatform('https://www.tiktok.com/@user/video/123'), 'tiktok');
});

test('detects instagram from hostname', () => {
  assert.equal(detectVideoPlatform('https://www.instagram.com/reel/abc'), 'instagram');
});

test('detects youtube from hostname including short domain', () => {
  assert.equal(detectVideoPlatform('https://youtu.be/abc123'), 'youtube');
  assert.equal(detectVideoPlatform('https://www.youtube.com/watch?v=abc123'), 'youtube');
});

test('falls back to other for unrecognized hosts', () => {
  assert.equal(detectVideoPlatform('https://example.com/recipe-video'), 'other');
});

test('returns null for null input', () => {
  assert.equal(detectVideoPlatform(null), null);
});

test('returns other for unparseable url', () => {
  assert.equal(detectVideoPlatform('not-a-url'), 'other');
});
