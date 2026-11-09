
export function readConfig(environment = process.env) {
  const rawPort = environment.PORT ?? '3000';

  if (!/^\d+$/.test(rawPort)) {
    throw new Error('PORT must be a whole number between 0 and 65535');
  }

  const port = Number(rawPort);

  if (!Number.isSafeInteger(port) || port > 65535) {
    throw new Error('PORT must be a whole number between 0 and 65535');
  }

  return Object.freeze({ port });
}
