import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createSqliteRepository } from '../src/repositories/sqlite.js';

test('SQLite repository preserves events, tiers and bookings after reopening', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ticketing-sqlite-'));
  const databasePath = path.join(directory, 'ticketing.sqlite');
  let repository = createSqliteRepository({ databasePath });

  try {
    await repository.createEvent({
      id: 'event-1',
      organizerId: 'organizer-1',
      title: 'Lagos Tech Meetup',
      city: 'Lagos',
      venue: 'Yaba Hub',
      startsAt: '2027-12-05T17:00:00.000Z',
      status: 'published',
      tierIds: [],
    });
    await repository.createTier({
      id: 'tier-1',
      eventId: 'event-1',
      name: 'General',
      priceCents: 5000,
      capacity: 3,
      sold: 1,
    });
    await repository.createBooking({
      id: 'booking-1',
      reference: 'ABC23456',
      userId: 'attendee-1',
      tierId: 'tier-1',
      quantity: 1,
      amountCents: 5000,
      status: 'pending',
      createdAt: '2026-11-17T00:00:00.000Z',
    });
    repository.close();

    repository = createSqliteRepository({ databasePath });

    assert.deepEqual(await repository.getEvent('event-1'), {
      id: 'event-1',
      organizerId: 'organizer-1',
      title: 'Lagos Tech Meetup',
      city: 'Lagos',
      venue: 'Yaba Hub',
      startsAt: '2027-12-05T17:00:00.000Z',
      status: 'published',
      tierIds: ['tier-1'],
    });
    assert.deepEqual(await repository.getTier('tier-1'), {
      id: 'tier-1',
      eventId: 'event-1',
      name: 'General',
      priceCents: 5000,
      capacity: 3,
      sold: 1,
    });
    assert.deepEqual(await repository.getBookingByReference('ABC23456'), {
      id: 'booking-1',
      reference: 'ABC23456',
      userId: 'attendee-1',
      tierId: 'tier-1',
      quantity: 1,
      amountCents: 5000,
      status: 'pending',
      createdAt: '2026-11-17T00:00:00.000Z',
    });
  } finally {
    repository.close();
    await rm(directory, { recursive: true, force: true });
  }
});
