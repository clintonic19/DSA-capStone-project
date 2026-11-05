import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStore,
  createEvent,
  addTier,
  publishEvent,
  listEventSummaries,
  bookTickets,
  seatsLeft,
} from '../src/domain/inventory.js';

function eventInput(overrides = {}) {
  return {
    title: 'Lagos Tech Meetup',
    city: 'Lagos',
    venue: 'Yaba Hub',
    startsAt: '2026-12-05T17:00:00Z',
    organizerId: 'organizer-1',
    ...overrides,
  };
}

function createDraftWithTier(store, overrides = {}) {
  const event = createEvent(store, eventInput(overrides));
  const tier = addTier(store, event.id, {
    name: 'General',
    priceCents: 500_000,
    capacity: 100,
  });

  return { event, tier };
}

test('S02: creating an event saves a draft with a new id and hides it from the public list', () => {
  const store = createStore();

  const event = createEvent(store, eventInput());

  assert.equal(typeof event.id, 'string');
  assert.ok(event.id.length > 0);
  assert.equal(event.status, 'draft');
  assert.equal(store.events.get(event.id), event);
  assert.deepEqual(listEventSummaries(store), []);
});

test('S02: a missing title, missing city or impossible date is rejected and nothing is saved', () => {
  const store = createStore();
  const cases = [
    eventInput({ title: '   ' }),
    eventInput({ city: '' }),
    eventInput({ startsAt: 'not-a-date' }),
    eventInput({ startsAt: '2026-02-30T17:00:00Z' }),
  ];

  for (const input of cases) {
    assert.throws(
      () => createEvent(store, input),
      (error) => error.code === 'VALIDATION',
    );
  }

  assert.equal(store.events.size, 0);
});

test('S03: adding a tier saves it with zero sold and the full capacity left', () => {
  const store = createStore();
  const event = createEvent(store, eventInput());

  const tier = addTier(store, event.id, {
    name: 'General',
    priceCents: 500_000,
    capacity: 100,
  });

  assert.equal(tier.name, 'General');
  assert.equal(tier.priceCents, 500_000);
  assert.equal(tier.capacity, 100);
  assert.equal(tier.sold, 0);
  assert.equal(seatsLeft(tier), 100);
  assert.equal(store.tiers.get(tier.id), tier);
  assert.deepEqual(event.tierIds, [tier.id]);
});

test('S03: a fractional price or capacity below one is rejected', () => {
  const store = createStore();
  const event = createEvent(store, eventInput());

  const cases = [
    { name: 'General', priceCents: 500_000.5, capacity: 100 },
    { name: 'General', priceCents: 500_000, capacity: 0 },
    { name: 'General', priceCents: 500_000, capacity: -1 },
  ];

  for (const input of cases) {
    assert.throws(
      () => addTier(store, event.id, input),
      (error) => error.code === 'VALIDATION',
    );
  }

  assert.equal(store.tiers.size, 0);
  assert.deepEqual(event.tierIds, []);
});

test('S03: adding a tier to a missing event is NOT_FOUND', () => {
  const store = createStore();

  assert.throws(
    () =>
      addTier(store, 'missing-event', {
        name: 'General',
        priceCents: 500_000,
        capacity: 100,
      }),
    (error) => error.code === 'NOT_FOUND',
  );
});

test('S04: publishing a draft with tiers makes it public', () => {
  const store = createStore();
  const { event } = createDraftWithTier(store);

  const published = publishEvent(store, event.id);
  const summaries = listEventSummaries(store);

  assert.equal(published.status, 'published');
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].id, event.id);
  assert.equal(summaries[0].status, 'published');
});

test('S04: publishing an event with no tiers is INVALID_STATE and leaves it a draft', () => {
  const store = createStore();
  const event = createEvent(store, eventInput());

  assert.throws(
    () => publishEvent(store, event.id),
    (error) => error.code === 'INVALID_STATE',
  );
  assert.equal(event.status, 'draft');
  assert.deepEqual(listEventSummaries(store), []);
});

test('S04: publishing a missing event is NOT_FOUND', () => {
  const store = createStore();

  assert.throws(
    () => publishEvent(store, 'missing-event'),
    (error) => error.code === 'NOT_FOUND',
  );
});

test('S04: drafts are hidden by default but shown when publishedOnly is false', () => {
  const store = createStore();
  const draft = createEvent(store, eventInput());
  const { event: publishedEvent } = createDraftWithTier(store, {
    title: 'Abuja Jazz Night',
    city: 'Abuja',
  });

  publishEvent(store, publishedEvent.id);

  assert.deepEqual(
    listEventSummaries(store).map((summary) => summary.id),
    [publishedEvent.id],
  );
  assert.deepEqual(
    listEventSummaries(store, { publishedOnly: false }).map(
      (summary) => summary.id,
    ),
    [draft.id, publishedEvent.id],
  );
});

test('listEventSummaries reports the cheapest tier and total seats left', () => {
  const store = createStore();
  const event = createEvent(store, eventInput());

  addTier(store, event.id, {
    name: 'General',
    priceCents: 750_000,
    capacity: 10,
  });
  addTier(store, event.id, {
    name: 'Early Bird',
    priceCents: 500_000,
    capacity: 3,
  });
  publishEvent(store, event.id);

  const [summary] = listEventSummaries(store);

  assert.equal(summary.tierCount, 2);
  assert.equal(summary.cheapestPriceCents, 500_000);
  assert.equal(summary.minPriceCents, 500_000);
  assert.equal(summary.seatsLeft, 13);
  assert.equal(summary.totalSeatsLeft, 13);
});

test('S06: booking two of three seats creates a pending booking and leaves one seat', () => {
  const store = createStore();
  const event = createEvent(store, eventInput());
  const tier = addTier(store, event.id, {
    name: 'General',
    priceCents: 500_000,
    capacity: 3,
  });
  publishEvent(store, event.id);

  const booking = bookTickets(store, tier.id, 'ada', 2);

  assert.equal(booking.status, 'pending');
  assert.equal(booking.quantity, 2);
  assert.equal(booking.amountCents, 1_000_000);
  assert.ok(Number.isInteger(booking.amountCents));
  assert.equal(tier.sold, 2);
  assert.equal(seatsLeft(tier), 1);
});

test('S06: asking for more seats than are left is SOLD_OUT and changes nothing', () => {
  const store = createStore();
  const event = createEvent(store, eventInput());
  const tier = addTier(store, event.id, {
    name: 'General',
    priceCents: 500_000,
    capacity: 3,
  });
  publishEvent(store, event.id);
  bookTickets(store, tier.id, 'ada', 2);

  const soldBefore = tier.sold;
  const bookingsBefore = store.bookings.size;

  assert.throws(
    () => bookTickets(store, tier.id, 'bayo', 2),
    (error) => error.code === 'SOLD_OUT',
  );
  assert.equal(tier.sold, soldBefore);
  assert.equal(store.bookings.size, bookingsBefore);
});

test('S06: quantities that are zero, negative, fractional or above ten are VALIDATION', () => {
  const store = createStore();
  const event = createEvent(store, eventInput());
  const tier = addTier(store, event.id, {
    name: 'General',
    priceCents: 500_000,
    capacity: 100,
  });
  publishEvent(store, event.id);

  for (const quantity of [0, -1, 1.5, 11]) {
    assert.throws(
      () => bookTickets(store, tier.id, 'ada', quantity),
      (error) => error.code === 'VALIDATION',
    );
  }

  assert.equal(tier.sold, 0);
  assert.equal(store.bookings.size, 0);
});
