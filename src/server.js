import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './http/app.js';
import { readConfig } from './config.js';

export function startServer({ port = readConfig().port } = {}) {
  const server = createApp();

  server.listen(port, () => {
    console.log(`Event ticketing server listening on port ${server.address().port}`);
  });

  return server;
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1]
  ? path.resolve(process.argv[1])
  : undefined;

if (invokedFile === currentFile) {
  try {
    startServer();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
