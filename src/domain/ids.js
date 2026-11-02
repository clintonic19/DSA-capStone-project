import { randomBytes, randomUUID } from 'node:crypto';
import { DomainError } from './errors.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; //

export function newId() {
  return randomUUID();
}

// 32 characters divides 256 evenly, so `byte % 32` has no bias.
// Math.random() would work too, but it is not meant for codes people rely on.
export function newReference(length = 8) {
  if (!Number.isInteger(length) || length < 1) {
    throw new DomainError('VALIDATION', 'Reference length must be a positive whole number');
  }

  const bytes = randomBytes(length);
  let reference = '';

  for (const byte of bytes) {
    reference += ALPHABET[byte % ALPHABET.length];
  }

  return reference;
}
