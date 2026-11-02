import { newId, newReference } from './ids.js';
import { Queue } from './waitlistQueue.js';
import { DomainError } from './errors.js';

export const MAX_TICKETS_PER_BOOKING = 10;

const CANCELABLE_STATUSES = new Set(['pending', 'paid']);

export function createStore() {
  return {
    events: new Map(),
    tiers: new Map(),
    bookings: new Map(),
    bookingsByReference: new Map(),
    waitlists: new Map(),
  };
}

function requireText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${field} is required`);
  }

  return value.trim();
}

function requireWholeNumber(value, field, minimum) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new DomainError(
      'VALIDATION',
      `${field} must be a whole number of at least ${minimum}`,
    );
  }

  return value;
}

function requireQuantity(quantity) {
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_TICKETS_PER_BOOKING
  ) {
    throw new DomainError(
      'VALIDATION',
      `Quantity must be a whole number between 1 and ${MAX_TICKETS_PER_BOOKING}`,
    );
  }

  return quantity;
}

function getEvent(store, eventId) {
  const event = store.events.get(eventId);

  if (!event) {
    throw new DomainError('NOT_FOUND', 'Event not found');
  }

  return event;
}

function getTier(store, tierId) {
  const tier = store.tiers.get(tierId);

  if (!tier) {
    throw new DomainError('NOT_FOUND', 'Ticket tier not found');
  }

  return tier;
}

export function createEvent(
  store,
  { title, city, venue = '', startsAt, organizerId } = {},
) {
  const startsAtDate = new Date(startsAt);

  if (Number.isNaN(startsAtDate.getTime())) {
    throw new DomainError('VALIDATION', 'startsAt must be a valid date');
  }

  if (typeof venue !== 'string') {
    throw new DomainError('VALIDATION', 'venue must be text');
  }

  const validatedTitle = requireText(title, 'Title');
  const validatedCity = requireText(city, 'City');
  const validatedOrganizerId =
    organizerId === undefined || organizerId === null
      ? organizerId
      : requireText(organizerId, 'Organizer id');

  const event = {
    id: newId(),
    organizerId: validatedOrganizerId,
    title: validatedTitle,
    city: validatedCity,
    venue: venue.trim(),
    startsAt: startsAtDate.toISOString(),
    status: 'draft',
    tierIds: [],
  };

  store.events.set(event.id, event);
  return event;
}

export function addTier(store, eventId, { name, priceCents, capacity } = {}) {
  const event = getEvent(store, eventId);
  const validatedName = requireText(name, 'Tier name');
  const validatedPrice = requireWholeNumber(priceCents, 'priceCents', 0);
  const validatedCapacity = requireWholeNumber(capacity, 'capacity', 1);

  const tier = {
    id: newId(),
    eventId,
    name: validatedName,
    priceCents: validatedPrice,
    capacity: validatedCapacity,
    sold: 0,
  };

  store.tiers.set(tier.id, tier);
  store.waitlists.set(tier.id, new Queue());
  event.tierIds.push(tier.id);

  return tier;
}

export function publishEvent(store, eventId) {
  const event = getEvent(store, eventId);

  if (event.tierIds.length === 0) {
    throw new DomainError(
      'INVALID_STATE',
      'Add at least one ticket tier before publishing',
    );
  }

  event.status = 'published';
  return event;
}

export function seatsLeft(tier) {
  return tier.capacity - tier.sold;
}

export function bookTickets(store, tierId, userId, quantity) {
  const tier = getTier(store, tierId);
  const validatedUserId = requireText(userId, 'User id');
  const validatedQuantity = requireQuantity(quantity);
  const left = seatsLeft(tier);

  if (left < validatedQuantity) {
    const message =
      left === 0
        ? `${tier.name} is sold out`
        : `Only ${left} ticket(s) left in ${tier.name}`;

    throw new DomainError('SOLD_OUT', message, { seatsLeft: left });
  }

  let reference;

  do {
    reference = newReference();
  } while (store.bookingsByReference.has(reference));

  const booking = {
    id: newId(),
    reference,
    userId: validatedUserId,
    tierId,
    quantity: validatedQuantity,
    amountCents: tier.priceCents * validatedQuantity,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  tier.sold += validatedQuantity;
  store.bookings.set(booking.id, booking);
  store.bookingsByReference.set(reference, booking);

  return booking;
}

export function findBookingByReference(store, reference) {
  if (typeof reference !== 'string' || reference.trim() === '') {
    throw new DomainError('VALIDATION', 'Booking reference is required');
  }

  return store.bookingsByReference.get(reference.trim());
}

export function cancelBooking(store, reference) {
  const booking = findBookingByReference(store, reference);

  if (!booking) {
    throw new DomainError('NOT_FOUND', 'Booking not found');
  }

  if (!CANCELABLE_STATUSES.has(booking.status)) {
    throw new DomainError(
      'INVALID_STATE',
      `A ${booking.status} booking cannot be cancelled`,
    );
  }

  getTier(store, booking.tierId).sold -= booking.quantity;
  booking.status = 'cancelled';

  return booking;
}

export function joinWaitlist(store, tierId, userId, quantity) {
  const tier = getTier(store, tierId);
  const validatedUserId = requireText(userId, 'User id');
  const validatedQuantity = requireQuantity(quantity);

  if (seatsLeft(tier) >= validatedQuantity) {
    throw new DomainError(
      'NOT_SOLD_OUT',
      'Seats are available, so book them instead',
    );
  }

  const queue = store.waitlists.get(tierId);

  if (!queue) {
    throw new DomainError('NOT_FOUND', 'Waitlist not found for this tier');
  }

  queue.enqueue({ userId: validatedUserId, quantity: validatedQuantity });

  return { position: queue.size };
}

export function offerNextOnWaitlist(store, tierId) {
  const tier = getTier(store, tierId);
  const queue = store.waitlists.get(tierId);

  if (!queue) {
    throw new DomainError('NOT_FOUND', 'Waitlist not found for this tier');
  }

  const next = queue.peek();

  if (!next || seatsLeft(tier) < next.quantity) {
    return undefined;
  }

  return queue.dequeue();
}
