import assert from 'node:assert/strict';
import { afterEach, test } from 'vitest';
import { z } from 'zod';

import { readJSON, writeJSON } from '../src/browser-storage.ts';

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function storage(raw) {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => raw, setItem: () => {} },
  });
}

afterEach(() => {
  for (const [key, descriptor] of [['window', originalWindow], ['localStorage', originalStorage]]) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});

test('returns the fallback during server rendering without reading storage', () => {
  delete globalThis.window;
  assert.deepEqual(readJSON('saved', z.array(z.string()), []), []);
});

test('returns validated data, including schema transformations', () => {
  storage('{"nickname":"  tester  "}');
  const schema = z.object({ nickname: z.string().trim().min(1) });
  assert.deepEqual(readJSON('profile', schema, { nickname: '' }), { nickname: 'tester' });
});

test('returns fallback for missing, corrupt, or structurally invalid stored data', () => {
  for (const raw of [null, '', '{broken', 'null', '{}', '[1]', '["study",false]']) {
    storage(raw);
    assert.deepEqual(readJSON('bookmarks', z.array(z.string()), []), []);
  }
});

test('rejects valid JSON with invalid nested fields', () => {
  storage('[{"studyId":"1","weekdays":[7]}]');
  const schema = z.array(z.object({ studyId: z.string(), weekdays: z.array(z.number().int().min(0).max(6)) }));
  assert.deepEqual(readJSON('schedule', schema, []), []);
});

test('storage denial does not break reading or writing', () => {
  storage(null);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('storage denied'); },
  });
  assert.equal(readJSON('nickname', z.string(), ''), '');
  assert.doesNotThrow(() => writeJSON('nickname', 'tester'));
});

test('writes JSON without changing its structure', () => {
  storage(null);
  let saved;
  globalThis.localStorage.setItem = (key, value) => { saved = [key, value]; };
  writeJSON('bookmarks', ['1', '2']);
  assert.deepEqual(saved, ['bookmarks', '["1","2"]']);
});
