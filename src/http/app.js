import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DomainError } from '../domain/errors.js';
import { createRouter } from './router.js';

const APP_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PUBLIC_DIRECTORY = path.resolve(APP_DIRECTORY, '../../public');
const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
]);

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function sendJson(response, status, value, headOnly = false) {
  const body = Buffer.from(JSON.stringify(value));

  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
  });
  response.end(headOnly ? undefined : body);
}

function domainErrorStatus(error) {
  if (error.code === 'NOT_FOUND') {
    return 404;
  }

  return 400;
}

function sendError(response, error, headOnly = false) {
  if (error instanceof HttpError) {
    sendJson(
      response,
      error.status,
      { error: { code: error.code, message: error.message } },
      headOnly,
    );
    return;
  }

  if (error instanceof DomainError) {
    sendJson(
      response,
      domainErrorStatus(error),
      { error: { code: error.code, message: error.message } },
      headOnly,
    );
    return;
  }

  sendJson(
    response,
    500,
    { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
    headOnly,
  );
}

async function readJsonBody(request) {
  const contentType = request.headers['content-type']
    ?.split(';')[0]
    .trim()
    .toLowerCase();

  if (
    contentType !== 'application/json' &&
    !contentType?.endsWith('+json')
  ) {
    request.resume();
    return undefined;
  }

  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Request body must be valid JSON');
  }
}

function isWithinDirectory(directory, target) {
  const relativePath = path.relative(directory, target);
  return (
    relativePath === '' ||
    (relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

async function serveStatic(request, response, pathname, publicDirectory) {
  let decodedPath;

  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    throw new HttpError(400, 'INVALID_PATH', 'Request path is invalid');
  }

  if (decodedPath.includes('\0')) {
    throw new HttpError(400, 'INVALID_PATH', 'Request path is invalid');
  }

  const relativeUrlPath =
    decodedPath === '/' ? 'index.html' : decodedPath.slice(1);
  const directory = await realpath(publicDirectory);
  const candidate = path.resolve(directory, relativeUrlPath);

  if (!isWithinDirectory(directory, candidate)) {
    throw new HttpError(404, 'NOT_FOUND', 'File not found');
  }

  let filePath;

  try {
    filePath = await realpath(candidate);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      throw new HttpError(404, 'NOT_FOUND', 'File not found');
    }

    throw error;
  }

  if (!isWithinDirectory(directory, filePath)) {
    throw new HttpError(404, 'NOT_FOUND', 'File not found');
  }

  const fileInfo = await stat(filePath);

  if (!fileInfo.isFile()) {
    throw new HttpError(404, 'NOT_FOUND', 'File not found');
  }

  const content = await readFile(filePath);
  response.writeHead(200, {
    'content-type':
      MIME_TYPES.get(path.extname(filePath).toLowerCase()) ??
      'application/octet-stream',
    'content-length': content.length,
  });
  response.end(request.method === 'HEAD' ? undefined : content);
}

export function createApp({ publicDirectory = DEFAULT_PUBLIC_DIRECTORY } = {}) {
  const router = createRouter();
  router.add('GET', '/health', () => ({ status: 'ok' }));

  return createServer(async (request, response) => {
    const headOnly = request.method === 'HEAD';

    try {
      const requestUrl = new URL(request.url, 'http://localhost');
      const body = await readJsonBody(request);
      const match = router.match(request.method, requestUrl.pathname);

      if (match) {
        const result = await match.handler({
          request,
          params: match.params,
          body,
          url: requestUrl,
        });
        sendJson(response, 200, result, headOnly);
        return;
      }

      if (
        requestUrl.pathname === '/api' ||
        requestUrl.pathname.startsWith('/api/')
      ) {
        throw new HttpError(404, 'NOT_FOUND', 'API route not found');
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        throw new HttpError(404, 'NOT_FOUND', 'Route not found');
      }

      await serveStatic(request, response, requestUrl.pathname, publicDirectory);
    } catch (error) {
      if (!(error instanceof HttpError) && !(error instanceof DomainError)) {
        console.error(error);
      }

      if (!response.headersSent) {
        sendError(response, error, headOnly);
      } else {
        response.destroy();
      }
    }
  });
}
