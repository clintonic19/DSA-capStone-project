import { newId, newReference } from '../domain/ids.js';
import { DomainError } from '../domain/errors.js';
import { assertTransition } from '../domain/bookingStateMachine.js';

const MAX_TICKETS_PER_BOOKING = 10;

function requireText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${field} is required`);
  }

  return value.trim();
}

function requireObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION', 'Booking must be an object');
  }
}

async function requireBooking(repository, reference) {
  const booking = await repository.getBookingByReference(reference);

  if (!booking) {
    throw new DomainError('NOT_FOUND', 'Booking not found');
  }

  return booking;
}

function requireOwner(booking, userId) {
  if (booking.userId !== userId) {
    throw new DomainError('FORBIDDEN', 'Only the attendee who booked can do this');
  }
}

export async function createBooking(repository, userId, input = {}) {
  requireObject(input);
  const tierId = requireText(input.tierId, 'Tier id');
  const quantity = input.quantity;

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

  const tier = await repository.getTier(tierId);

  if (!tier) {
    throw new DomainError('NOT_FOUND', 'Ticket tier not found');
  }

  const event = await repository.getEvent(tier.eventId);

  if (!event || event.status !== 'published') {
    throw new DomainError('INVALID_STATE', 'Tickets can only be booked for a published event');
  }

  const seatsLeft = tier.capacity - tier.sold;

  if (seatsLeft < quantity) {
    throw new DomainError(
      'SOLD_OUT',
      seatsLeft === 0
        ? `${tier.name} is sold out`
        : `Only ${seatsLeft} ticket(s) left in ${tier.name}`,
      { seatsLeft },
    );
  }

  let reference;

  do {
    reference = newReference();
  } while (await repository.getBookingByReference(reference));

  const booking = {
    id: newId(),
    reference,
    userId,
    tierId,
    quantity,
    amountCents: tier.priceCents * quantity,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  tier.sold += quantity;
  await repository.saveTier(tier);
  return repository.createBooking(booking);
}

export async function payForBooking(
  repository,
  paymentGateway,
  userId,
  reference,
  { decline = false } = {},
) {
  const booking = await requireBooking(repository, reference);
  requireOwner(booking, userId);
  assertTransition(booking.status, 'paid');

  const payment = await paymentGateway.charge({
    bookingReference: booking.reference,
    amountCents: booking.amountCents,
    decline,
  });

  if (!payment.success) {
    throw new DomainError('PAYMENT_DECLINED', 'Payment was declined');
  }

  booking.status = 'paid';
  return repository.saveBooking(booking);
}

export async function cancelBooking(repository, userId, reference) {
  const booking = await requireBooking(repository, reference);
  requireOwner(booking, userId);

  if (booking.status !== 'pending') {
    throw new DomainError(
      'INVALID_TRANSITION',
      `A ${booking.status} booking cannot be cancelled in this build`,
    );
  }

  assertTransition(booking.status, 'cancelled');
  const tier = await repository.getTier(booking.tierId);

  if (!tier) {
    throw new DomainError('NOT_FOUND', 'Ticket tier not found');
  }

  tier.sold -= booking.quantity;
  booking.status = 'cancelled';
  await repository.saveTier(tier);
  return repository.saveBooking(booking);
}
