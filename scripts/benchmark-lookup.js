import { randomInt } from 'node:crypto';
import { newReference } from '../src/domain/ids.js';

const BOOKINGS = 100_000;
const LOOKUPS = 500;

const list = [];
const map = new Map();

for (let index = 0; index < BOOKINGS; index += 1) {
  const booking = { reference: newReference(), number: index };
  list.push(booking);
  map.set(booking.reference, booking); //
}

const targets = Array.from(
  { length: LOOKUPS },
  () => list[randomInt(BOOKINGS)].reference,
);

function time(label, lookup) {
  const start = performance.now(); 

  for (const reference of targets) {
    lookup(reference);
  }

  const milliseconds = performance.now() - start;
  console.log(
    `${label.padEnd(12)} ${milliseconds.toFixed(2).padStart(10)} ms for ${LOOKUPS} lookups`,
  );

  return milliseconds;
}

console.log(`${BOOKINGS.toLocaleString()} bookings in memory\n`);

const arrayTime = time('Array.find', (reference) =>
  list.find((booking) => booking.reference === reference),
);
const mapTime = time('Map.get', (reference) => map.get(reference));

const timesFaster = Math.round(arrayTime / Math.max(mapTime, 0.001));

console.log(`\nThe Map was about ${timesFaster.toLocaleString()}x faster.`);
console.log(
  'Double BOOKINGS and run it again. Which number grows, and which one stays flat?',
);
