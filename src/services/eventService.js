import { newId } from '../domain/ids.js';
import { DomainError } from '../domain/errors.js';
import { filterEvents, sortEvents } from '../domain/eventSearch.js';

function requireObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION', `${label} must be an object`);
  }
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

function requireValidDate(value) {
  if (typeof value !== 'string') {
    throw new DomainError('VALIDATION', 'startsAt must be a valid date');
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(value.trim());

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new DomainError('VALIDATION', 'startsAt must be a valid date');
    }
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new DomainError('VALIDATION', 'startsAt must be a valid date');
  }

  return date.toISOString();
}

async function requireEvent(repository, eventId) {
  const event = await repository.getEvent(eventId);

  if (!event) {
    throw new DomainError('NOT_FOUND', 'Event not found');
  }

  return event;
}

function requireOrganizer(event, userId) {
  if (event.organizerId !== userId) {
    throw new DomainError('FORBIDDEN', 'Only the event organizer can do this');
  }
}

export async function createEvent(repository, userId, input = {}) {
  requireObject(input, 'Event');
  const title = requireText(input.title, 'Title');
  const city = requireText(input.city, 'City');
  const venue = input.venue === undefined ? '' : input.venue;

  if (typeof venue !== 'string') {
    throw new DomainError('VALIDATION', 'venue must be text');
  }

  const event = {
    id: newId(),
    organizerId: userId,
    title,
    city,
    venue: venue.trim(),
    startsAt: requireValidDate(input.startsAt),
    status: 'draft',
    tierIds: [],
  };

  return repository.createEvent(event);
}

export async function addTier(repository, userId, eventId, input = {}) {
  requireObject(input, 'Ticket tier');
  const event = await requireEvent(repository, eventId);
  requireOrganizer(event, userId);

  const tier = {
    id: newId(),
    eventId: event.id,
    name: requireText(input.name, 'Tier name'),
    priceCents: requireWholeNumber(input.priceCents, 'priceCents', 0),
    capacity: requireWholeNumber(input.capacity, 'capacity', 1),
    sold: 0,
  };

  await repository.createTier(tier);
  event.tierIds.push(tier.id);
  await repository.saveEvent(event);
  return tier;
}

export async function publishEvent(repository, userId, eventId) {
  const event = await requireEvent(repository, eventId);
  requireOrganizer(event, userId);

  if (event.tierIds.length === 0) {
    throw new DomainError(
      'INVALID_STATE',
      'Add at least one ticket tier before publishing',
    );
  }

  event.status = 'published';
  return repository.saveEvent(event);
}

export async function searchEvents(repository, criteria = {}) {
  const [events, tiers] = await Promise.all([
    repository.listEvents(),
    repository.listTiers(),
  ]);
  const tiersByEvent = new Map();

  for (const tier of tiers) {
    const eventTiers = tiersByEvent.get(tier.eventId) ?? [];
    eventTiers.push(tier);
    tiersByEvent.set(tier.eventId, eventTiers);
  }

  const summaries = events
    .filter((event) => event.status === 'published')
    .map((event) => {
      const eventTiers = tiersByEvent.get(event.id) ?? [];
      const prices = eventTiers.map((tier) => tier.priceCents);
      const seatsLeft = eventTiers.reduce(
        (total, tier) => total + tier.capacity - tier.sold,
        0,
      );
      const cheapestPriceCents =
        prices.length === 0 ? null : Math.min(...prices);

      return {
        ...event,
        tiers: eventTiers,
        tierCount: eventTiers.length,
        cheapestPriceCents,
        minPriceCents: cheapestPriceCents,
        seatsLeft,
        totalSeatsLeft: seatsLeft,
      };
    });

  return sortEvents(filterEvents(summaries, criteria), criteria.sortBy ?? 'date');
}
