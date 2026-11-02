import {
  createStore,
  createEvent,
  addTier,
  bookTickets,
  cancelBooking,
  findBookingByReference,
  joinWaitlist,
  offerNextOnWaitlist,
  seatsLeft,
} from '../src/domain/inventory.js';
import { DomainError } from '../src/domain/errors.js';

const store = createStore();

const event = createEvent(store, {
  title: 'Lagos Tech Meetup',
  city: 'Lagos',
  venue: 'Yaba Hub',
  startsAt: '2026-12-05T17:00:00Z',
  organizerId: 'organizer-1',
});

const tier = addTier(store, event.id, {
  name: 'General',
  priceCents: 500_000,
  capacity: 3,
});

console.log(
  `Created "${event.title}" with ${tier.capacity} seats in ${tier.name}.\n`,
);

function attempt(label, action) {
  try {
    const result = action();
    console.log(`OK    ${label}`);
    return result;
  } catch (error) {
    if (!(error instanceof DomainError)) {
      throw error;
    }

    console.log(`FAIL  ${label} -> ${error.code}: ${error.message}`);
    return undefined;
  }
}

const ada = attempt('Ada books 2 tickets', () =>
  bookTickets(store, tier.id, 'ada', 2),
);

attempt('Bayo asks for 2 tickets when only 1 is left', () =>
  bookTickets(store, tier.id, 'bayo', 2),
);

attempt('Bayo books the last ticket', () =>
  bookTickets(store, tier.id, 'bayo', 1),
);

console.log(`\nSeats left: ${seatsLeft(tier)}\n`);

attempt('Chidi joins the waitlist for 2 tickets', () =>
  joinWaitlist(store, tier.id, 'chidi', 2),
);

attempt('Dayo joins the waitlist for 1 ticket', () =>
  joinWaitlist(store, tier.id, 'dayo', 1),
);

const found = findBookingByReference(store, ada.reference);
console.log(
  `\nFound Ada's booking by reference ${ada.reference}: ${found.userId}, ` +
    `${found.quantity} tickets, ${found.amountCents} cents`,
);

console.log();
attempt('Ada cancels her booking', () =>
  cancelBooking(store, ada.reference),
);
console.log(`Seats left after the cancellation: ${seatsLeft(tier)}`);

const next = offerNextOnWaitlist(store, tier.id);
console.log(
  `Next on the waitlist: ${next.userId} (wants ${next.quantity} tickets)`,
);
