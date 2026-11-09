import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/http/app.js';

async function withServer(server, callback) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('GET /health responds over HTTP with the service status', async () => {
  const server = createApp();

  await withServer(server, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('invalid JSON and unknown API paths use the standard JSON error shape', async () => {
  const server = createApp();

  await withServer(server, async (baseUrl) => {
    const invalidJson = await fetch(`${baseUrl}/api/example`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    assert.equal(invalidJson.status, 400);
    assert.deepEqual(await invalidJson.json(), {
      error: {
        code: 'INVALID_JSON',
        message: 'Request body must be valid JSON',
      },
    });

    const unknownApi = await fetch(`${baseUrl}/api/missing`);
    assert.equal(unknownApi.status, 404);
    assert.deepEqual(await unknownApi.json(), {
      error: { code: 'NOT_FOUND', message: 'API route not found' },
    });
  });
});

test('static files are served without allowing traversal outside public', async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'ticketing-public-'),
  );
  const publicDirectory = path.join(temporaryDirectory, 'public');
  await mkdir(publicDirectory);
  await writeFile(path.join(publicDirectory, 'hello.txt'), 'hello');
  await writeFile(path.join(temporaryDirectory, 'outside.txt'), 'secret');
  const server = createApp({ publicDirectory });

  try {
    await withServer(server, async (baseUrl) => {
      const staticResponse = await fetch(`${baseUrl}/hello.txt`);
      assert.equal(staticResponse.status, 200);
      assert.equal(await staticResponse.text(), 'hello');

      const traversalResponse = await fetch(
        `${baseUrl}/%2e%2e%2foutside.txt`,
      );
      assert.equal(traversalResponse.status, 404);
      assert.deepEqual(await traversalResponse.json(), {
        error: { code: 'NOT_FOUND', message: 'File not found' },
      });
    });
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
