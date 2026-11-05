import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterEvents,
  sortEvents,
  searchEvents,
} from '../src/domain/eventSearch.js';

function summary(overrides = {}) {
  return {
    id: 'event-1',
    title: 'Lagos Tech Meetup',
    city: 'Lagos',
    venue: 'Yaba Hub',
    startsAt: '2026-12-05T17:00:00.000Z',
    status: 'published',
    tierCount: 1,
    cheapestPriceCents: 500_000,
    minPriceCents: 500_000,
    seatsLeft: 10,
    totalSeatsLeft: 10,
    ...overrides,
  };
}

function noTierSummary(overrides = {}) {
  return summary({
    tierCount: 0,
    cheapestPriceCents: null,
    minPriceCents: null,
    seatsLeft: 0,
    totalSeatsLeft: 0,
    ...overrides,
  });
}

test('S05: q matches title or venue, ignoring case', () => {
  const meetup = summary({ id: '1', title: 'Lagos Tech Meetup' });
  const jazz = summary({
    id: '2',
    title: 'Abuja Jazz Night',
    venue: 'Blue Note',
  });
  const venueMatch = summary({
    id: '3',
    title: 'Lagos Tech Meetup',
    venue: 'Jazz Hall',
  });
  const events = [meetup, jazz, venueMatch];

  assert.deepEqual(
    filterEvents(events, { q: 'JAZZ' }).map((event) => event.id),
    ['2', '3'],
  );
});

test('S05: city matches exactly, ignoring case', () => {
  const lagos = summary({ id: '1', city: 'Lagos' });
  const abuja = summary({ id: '2', city: 'Abuja' });
  const lagosIsland = summary({ id: '3', city: 'Lagos Island' });

  assert.deepEqual(
    filterEvents([lagos, abuja, lagosIsland], { city: 'lagos' }).map(
      (event) => event.id,
    ),
    ['1'],
  );
  assert.deepEqual(
    filterEvents([lagos, abuja, lagosIsland], { city: 'LAGOS' }).map(
      (event) => event.id,
    ),
    ['1'],
  );
});

test('S05: a maximum price uses the cheapest tier, leaves out events without tiers, and price sort is cheapest first', () => {
  const expensive = summary({
    id: '1',
    title: 'Expensive',
    cheapestPriceCents: 900_000,
    minPriceCents: 900_000,
  });
  const cheapB = summary({
    id: '2',
    title: 'Bravo',
    cheapestPriceCents: 100_000,
    minPriceCents: 100_000,
  });
  const cheapA = summary({
    id: '3',
    title: 'Alpha',
    cheapestPriceCents: 100_000,
    minPriceCents: 100_000,
  });
  const noTiers = noTierSummary({ id: '4', title: 'No Tiers' });
  const events = [expensive, cheapB, cheapA, noTiers];

  const filtered = filterEvents(events, { maxPriceCents: 500_000 });
  const sorted = sortEvents(filtered, 'price');

  assert.deepEqual(
    sorted.map((event) => event.id),
    ['3', '2'],
  );
});

test('S05: date sort puts the earliest first and breaks same-time ties by title then id', () => {
  const earlier = summary({
    id: '1',
    title: 'Zulu',
    startsAt: '2026-12-04T17:00:00.000Z',
  });
  const sameTimeB = summary({
    id: '2',
    title: 'Bravo',
    startsAt: '2026-12-05T17:00:00.000Z',
  });
  const sameTimeA = summary({
    id: '3',
    title: 'Alpha',
    startsAt: '2026-12-05T17:00:00.000Z',
  });
  const sameTitleHighId = summary({
    id: '9',
    title: 'Same',
    startsAt: '2026-12-06T17:00:00.000Z',
  });
  const sameTitleLowId = summary({
    id: '5',
    title: 'Same',
    startsAt: '2026-12-06T17:00:00.000Z',
  });

  const sorted = sortEvents(
    [sameTitleHighId, sameTimeB, earlier, sameTitleLowId, sameTimeA],
    'date',
  );

  assert.deepEqual(
    sorted.map((event) => event.id),
    ['1', '3', '2', '5', '9'],
  );
});

test('S05: a date-only to value includes the whole day', () => {
  const evening = summary({
    id: '1',
    startsAt: '2026-12-05T17:00:00.000Z',
  });
  const nextDay = summary({
    id: '2',
    startsAt: '2026-12-06T00:00:00.000Z',
  });
  const midnight = summary({
    id: '3',
    startsAt: '2026-12-05T00:00:00.000Z',
  });

  assert.deepEqual(
    filterEvents([evening, nextDay, midnight], { to: '2026-12-05' }).map(
      (event) => event.id,
    ),
    ['1', '3'],
  );
  assert.deepEqual(
    filterEvents([evening, nextDay, midnight], { from: '2026-12-05' }).map(
      (event) => event.id,
    ),
    ['1', '2', '3'],
  );
});

test('S05: a bad date, a non-whole price or an unknown sort option is VALIDATION', () => {
  const events = [summary()];

  for (const criteria of [
    { from: 'not-a-date' },
    { to: '2026-02-30' },
    { from: '2026-13-01' },
    { maxPriceCents: 500_000.5 },
    { maxPriceCents: '500000' },
  ]) {
    assert.throws(
      () => filterEvents(events, criteria),
      (error) => error.code === 'VALIDATION',
    );
  }

  assert.throws(
    () => sortEvents(events, 'title'),
    (error) => error.code === 'VALIDATION',
  );
  assert.throws(
    () => searchEvents(events, {}, 'unknown'),
    (error) => error.code === 'VALIDATION',
  );
});

test('S05: filtering and sorting never change the original list', () => {
  const events = [
    summary({ id: '1', title: 'Bravo', cheapestPriceCents: 900_000 }),
    summary({ id: '2', title: 'Alpha', cheapestPriceCents: 100_000 }),
    noTierSummary({ id: '3', title: 'Charlie' }),
  ];
  const original = JSON.parse(JSON.stringify(events));

  const filtered = filterEvents(events, { q: 'a' });
  const sorted = sortEvents(events, 'price');
  const searched = searchEvents(events, { city: 'Lagos' }, 'date');

  assert.deepEqual(events, original);
  assert.notEqual(filtered, events);
  assert.notEqual(sorted, events);
  assert.notEqual(searched, events);
});

test('S05: empty lists produce empty lists', () => {
  assert.deepEqual(filterEvents([], { q: 'anything' }), []);
  assert.deepEqual(sortEvents([], 'date'), []);
  assert.deepEqual(sortEvents([], 'price'), []);
  assert.deepEqual(sortEvents([], 'availability'), []);
  assert.deepEqual(searchEvents([], {}, 'price'), []);
});

test('S05: availability sort puts the most seats left first and breaks ties by title then id', () => {
  const few = summary({ id: '1', title: 'Few', seatsLeft: 1 });
  const manyB = summary({ id: '2', title: 'Bravo', seatsLeft: 20 });
  const manyA = summary({ id: '3', title: 'Alpha', seatsLeft: 20 });
  const soldOut = summary({ id: '4', title: 'Sold Out', seatsLeft: 0 });

  assert.deepEqual(
    sortEvents([few, manyB, manyA, soldOut], 'availability').map(
      (event) => event.id,
    ),
    ['3', '2', '1', '4'],
  );
});

test('S05: price sort puts events with no price last', () => {
  const noPrice = noTierSummary({ id: '1', title: 'Alpha' });
  const priced = summary({
    id: '2',
    title: 'Zulu',
    cheapestPriceCents: 100_000,
    minPriceCents: 100_000,
  });

  assert.deepEqual(
    sortEvents([noPrice, priced], 'price').map((event) => event.id),
    ['2', '1'],
  );
});

test('S05: onlyAvailable leaves out sold-out events and events with no tiers', () => {
  const available = summary({ id: '1', seatsLeft: 1 });
  const soldOut = summary({ id: '2', seatsLeft: 0 });
  const noTiers = noTierSummary({ id: '3' });

  assert.deepEqual(
    filterEvents([available, soldOut, noTiers], { onlyAvailable: true }).map(
      (event) => event.id,
    ),
    ['1'],
  );
});

test('S05: searchEvents filters first and then sorts', () => {
  const later = summary({
    id: '1',
    title: 'Lagos Tech Meetup',
    startsAt: '2026-12-06T17:00:00.000Z',
  });
  const earlier = summary({
    id: '2',
    title: 'Lagos Tech Meetup',
    startsAt: '2026-12-04T17:00:00.000Z',
  });
  const other = summary({
    id: '3',
    title: 'Abuja Jazz Night',
    startsAt: '2026-12-03T17:00:00.000Z',
  });

  assert.deepEqual(
    searchEvents([later, other, earlier], { q: 'tech' }, 'date').map(
      (event) => event.id,
    ),
    ['2', '1'],
  );
});
