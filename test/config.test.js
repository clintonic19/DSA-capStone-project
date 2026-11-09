import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig } from '../src/config.js';

test('configuration defaults to port 3000 and accepts a configured port', () => {
  assert.deepEqual(readConfig({}), { port: 3000 });
  assert.deepEqual(readConfig({ PORT: '8080' }), { port: 8080 });
  assert.deepEqual(readConfig({ PORT: '0' }), { port: 0 });
});

test('configuration rejects invalid ports', () => {
  for (const PORT of ['invalid', '-1', '65536', '3.5']) {
    assert.throws(() => readConfig({ PORT }), /PORT must be a whole number/);
  }
});
