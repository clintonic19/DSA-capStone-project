import { createSqliteRepository } from '../src/repositories/sqlite.js';
import {
  addTier,
  createEvent,
  publishEvent,
} from '../src/services/eventService.js';
import { createBooking } from '../src/services/bookingService.js';
import { DomainError } from '../src/domain/errors.js';

const repository = createSqliteRepository({ databasePath: ':memory:' });

try {
  const organizerId = 'demo-organizer';
  const event = await createEvent(repository, organizerId, {
    title: 'Last Ticket Race',
    city: 'Lagos',
    startsAt: '2027-12-05T17:00:00Z',
  });

  const tier = await addTier(repository, organizerId, event.id, {
    name: 'General',
    priceCents: 5000,
    capacity: 2,
  });
  await publishEvent(repository, organizerId, event.id);
  await createBooking(repository, 'first-attendee', {
    tierId: tier.id,
    quantity: 1,
  });
  
  const tierBeforeRace = await repository.getTier(tier.id);
  console.log(
    `Seats left before requests: ${tierBeforeRace.capacity - tierBeforeRace.sold}`,
  );

  const attempts = Array.from({ length: 50 }, (_, index) =>
    createBooking(repository, `racer-${index + 1}`, {
      tierId: tier.id,
      quantity: 1,
    }),
  );

  const results = await Promise.all(
    attempts.map((attempt) =>
      attempt.then(
        () => true,
        (error) => {
          if (!(error instanceof DomainError) || error.code !== 'SOLD_OUT') {
            throw error;
          }
          return false;
        },
      ),
    ),
  );

  const successfulBookings = results.filter(Boolean).length;
  
  const finalTier = await repository.getTier(tier.id);

  console.log(`Booking requests: ${attempts.length}`);
  console.log(`Bookings succeeded: ${successfulBookings}`);
  console.log(`Seats sold: ${finalTier.sold}`);
} finally {
  repository.close();
}
