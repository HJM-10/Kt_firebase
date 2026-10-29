import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPin, directionsUrl, locationPayload } from '../src/utils/location.js';
test('only complete finite coordinate pairs produce a Google directions link', () => {
  for (const value of [{}, { latitude: null, longitude: null }, { latitude: '', longitude: '' }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: NaN }, { latitude: 0, longitude: 181 }]) {
    assert.equal(hasPin(value), false); assert.equal(directionsUrl(value), null);
  }
  const url = new URL(directionsUrl({ latitude: 0, longitude: 0 }));
  assert.equal(url.hostname, 'www.google.com'); assert.equal(url.searchParams.get('destination'), '0,0');
  assert.equal(url.searchParams.get('api'), '1'); assert.equal(url.searchParams.has('origin'), false);
});
test('location edits preserve precision, trim addresses and clear pins atomically', () => {
  assert.deepEqual(locationPayload({ address: '  Gate 2  ', latitude: '24.860735', longitude: '67.001137' }), { address: 'Gate 2', latitude: 24.860735, longitude: 67.001137 });
  assert.deepEqual(locationPayload({ latitude: '', longitude: '' }), { address: null, latitude: null, longitude: null });
  assert.throws(() => locationPayload({ latitude: '0', longitude: '' }));
  assert.throws(() => locationPayload({ latitude: 'abc', longitude: '1' }));
});
