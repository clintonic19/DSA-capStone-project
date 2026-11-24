import { createSqliteRepository } from '../src/repositories/sqlite.js';
import {
  addTier,
  createEvent,
  publishEvent,
} from '../src/services/eventService.js';

const repository = createSqliteRepository();

try {
  const events = await repository.listEvents();

  if (events.length > 0) {
    console.log('Database already contains events; seed skipped.');
  } else {
    const event = await createEvent(repository, 'seed-organizer', {
      title: 'Lagos Tech Meetup',
      city: 'Lagos',
      venue: 'Yaba Hub',
      startsAt: '2027-12-05T17:00:00Z',
    });
    await addTier(repository, 'seed-organizer', event.id, {
      name: 'General',
      priceCents: 500000,
      capacity: 100,
    });
    await publishEvent(repository, 'seed-organizer', event.id);
    console.log('Seeded the database with Lagos Tech Meetup.');
  }
} finally {
  repository.close();
}
