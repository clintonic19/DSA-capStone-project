import { DomainError } from './errors.js';
import { mergeSort } from './sorting.js';

const PRICE_FIELDS = [
  'cheapestPriceCents',
  'minPriceCents',
  'lowestPriceCents',
  'minTierPriceCents',
  'priceCents',
  'minPrice',
];

const SEAT_FIELDS = [
  'seatsLeft',
  'totalSeatsLeft',
  'availableSeats',
  'seatsAvailable',
  'availability',
];

function cheapestPrice(summary) {
  for (const field of PRICE_FIELDS) {
    const value = summary[field];

    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
  }

  if (Array.isArray(summary.tiers)) {
    let cheapest = null;

    for (const tier of summary.tiers) {
      if (typeof tier.priceCents !== 'number') {
        continue;
      }

      if (cheapest === null || tier.priceCents < cheapest) {
        cheapest = tier.priceCents;
      }
    }

    return cheapest;
  }

  return null;
}

function seatsLeft(summary) {
  for (const field of SEAT_FIELDS) {
    const value = summary[field];

    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
  }

  if (Array.isArray(summary.tiers)) {
    let total = 0;

    for (const tier of summary.tiers) {
      if (typeof tier.seatsLeft === 'number') {
        total += tier.seatsLeft;
      } else if (
        typeof tier.capacity === 'number' &&
        typeof tier.sold === 'number'
      ) {
        total += tier.capacity - tier.sold;
      }
    }

    return total;
  }

  return 0;
}

function parseBoundary(value, field, endOfDay) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainError('VALIDATION', `${field} must be a valid ISO date`);
  }

  const text = value.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(text);

  if (!dateParts) {
    throw new DomainError('VALIDATION', `${field} must be a valid ISO date`);
  }

  const year = Number(dateParts[1]);
  const month = Number(dateParts[2]);
  const day = Number(dateParts[3]);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));

  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    throw new DomainError('VALIDATION', `${field} must be a valid ISO date`);
  }

  const normalized = dateOnly
    ? `${text}${endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'}`
    : text;
  const time = Date.parse(normalized);

  if (Number.isNaN(time)) {
    throw new DomainError('VALIDATION', `${field} must be a valid ISO date`);
  }

  return time;
}

function compareText(left, right) {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function compareTitleThenId(left, right) {
  const titleComparison = compareText(left.title ?? '', right.title ?? '');

  if (titleComparison !== 0) {
    return titleComparison;
  }

  return compareText(left.id ?? '', right.id ?? '');
}

function eventTime(summary) {
  const time = Date.parse(summary.startsAt);
  return Number.isNaN(time) ? Infinity : time;
}

function compareByDate(left, right) {
  const leftTime = eventTime(left);
  const rightTime = eventTime(right);

  if (leftTime < rightTime) {
    return -1;
  }

  if (leftTime > rightTime) {
    return 1;
  }

  return compareTitleThenId(left, right);
}

function compareByPrice(left, right) {
  const leftPrice = cheapestPrice(left);
  const rightPrice = cheapestPrice(right);

  if (leftPrice === null && rightPrice === null) {
    return compareTitleThenId(left, right);
  }

  if (leftPrice === null) {
    return 1;
  }

  if (rightPrice === null) {
    return -1;
  }

  if (leftPrice < rightPrice) {
    return -1;
  }

  if (leftPrice > rightPrice) {
    return 1;
  }

  return compareTitleThenId(left, right);
}

function compareByAvailability(left, right) {
  const leftSeats = seatsLeft(left);
  const rightSeats = seatsLeft(right);

  if (leftSeats > rightSeats) {
    return -1;
  }

  if (leftSeats < rightSeats) {
    return 1;
  }

  return compareTitleThenId(left, right);
}

export function filterEvents(summaries, criteria = {}) {
  const query =
    criteria.q === undefined || criteria.q === null
      ? ''
      : String(criteria.q).trim().toLowerCase();
  const city =
    criteria.city === undefined || criteria.city === null
      ? ''
      : String(criteria.city).trim().toLowerCase();
  const hasFrom = criteria.from !== undefined && criteria.from !== null;
  const hasTo = criteria.to !== undefined && criteria.to !== null;
  const hasMaxPrice =
    criteria.maxPriceCents !== undefined && criteria.maxPriceCents !== null;

  let fromTime;
  let toTime;

  if (hasFrom) {
    fromTime = parseBoundary(criteria.from, 'from', false);
  }

  if (hasTo) {
    toTime = parseBoundary(criteria.to, 'to', true);
  }

  if (hasMaxPrice && !Number.isInteger(criteria.maxPriceCents)) {
    throw new DomainError(
      'VALIDATION',
      'maxPriceCents must be a whole number',
    );
  }

  const filtered = [];

  for (const summary of summaries) {
    if (query !== '') {
      const title = String(summary.title ?? '').toLowerCase();
      const venue = String(summary.venue ?? '').toLowerCase();

      if (!title.includes(query) && !venue.includes(query)) {
        continue;
      }
    }

    if (city !== '') {
      const summaryCity = String(summary.city ?? '').trim().toLowerCase();

      if (summaryCity !== city) {
        continue;
      }
    }

    if (hasFrom || hasTo) {
      const startsAt = Date.parse(summary.startsAt);

      if (Number.isNaN(startsAt)) {
        continue;
      }

      if (hasFrom && startsAt < fromTime) {
        continue;
      }

      if (hasTo && startsAt > toTime) {
        continue;
      }
    }

    if (hasMaxPrice) {
      const price = cheapestPrice(summary);

      if (price === null || price > criteria.maxPriceCents) {
        continue;
      }
    }

    if (criteria.onlyAvailable && seatsLeft(summary) <= 0) {
      continue;
    }

    filtered.push(summary);
  }

  return filtered;
}

export function sortEvents(summaries, sortBy) {
  let compare;

  if (sortBy === 'date') {
    compare = compareByDate;
  } else if (sortBy === 'price') {
    compare = compareByPrice;
  } else if (sortBy === 'availability') {
    compare = compareByAvailability;
  } else {
    throw new DomainError('VALIDATION', `Unknown sort option: ${sortBy}`);
  }

  return mergeSort(summaries, compare);
}

export function searchEvents(summaries, criteria, sortBy) {
  return sortEvents(filterEvents(summaries, criteria), sortBy);
}
