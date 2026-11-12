import { DomainError } from '../domain/errors.js';
import {
  addTier,
  createEvent,
  publishEvent,
  searchEvents,
} from '../services/eventService.js';

import {
  cancelBooking,
  createBooking,
  payForBooking,
} from '../services/bookingService.js';

function requireUserId(request) {
  const userId = request.headers['x-user-id'];

  if (typeof userId !== 'string' || userId.trim() === '') {
    throw new DomainError(
      'AUTHENTICATION_REQUIRED',
      'x-user-id header is required',
    );
  }
  return userId.trim();
}

function respond(statusCode, body) {
  return { statusCode, body };
}

function routeOptions(url) {
  const maxPrice = url.searchParams.get('maxPriceCents');
  const onlyAvailable = url.searchParams.get('onlyAvailable');

  if (maxPrice !== null && !/^-?\d+$/.test(maxPrice)) {
    throw new DomainError(
      'VALIDATION',
      'maxPriceCents must be a whole number',
    );
  }

  if (
    onlyAvailable !== null &&
    onlyAvailable !== 'true' &&
    onlyAvailable !== 'false'
  ) {
    throw new DomainError(
      'VALIDATION',
      'onlyAvailable must be true or false',
    );
  }

  return {
    q: url.searchParams.get('q') ?? undefined,
    city: url.searchParams.get('city') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
    maxPriceCents: maxPrice === null ? undefined : Number(maxPrice),
    onlyAvailable: onlyAvailable === 'true',
    sortBy: url.searchParams.get('sortBy') ?? 'date',
  };
}

export function registerApiRoutes(router, { repository, paymentGateway }) {
  router
    .add('POST', '/api/events', async ({ request, body }) => {
      const event = await createEvent(
        repository,
        requireUserId(request),
        body,
      );
      return respond(201, event);
    })
    .add('POST', '/api/events/:id/tiers', async ({ request, params, body }) => {
      const tier = await addTier(
        repository,
        requireUserId(request),
        params.id,
        body,
      );
      return respond(201, tier);
    })
    .add('POST', '/api/events/:id/publish', async ({ request, params }) => {
      const event = await publishEvent(
        repository,
        requireUserId(request),
        params.id,
      );
      return respond(200, event);
    })
    .add('GET', '/api/events', async ({ url }) =>
      respond(200, await searchEvents(repository, routeOptions(url))),
    )
    .add('POST', '/api/bookings', async ({ request, body }) => {
      const booking = await createBooking(
        repository,
        requireUserId(request),
        body,
      );
      return respond(201, booking);
    })
    .add(
      'POST',
      '/api/bookings/:reference/pay',
      async ({ request, params, body }) => {
        if (
          body !== undefined &&
          (body === null || typeof body !== 'object' || Array.isArray(body))
        ) {
          throw new DomainError('VALIDATION', 'Payment options must be an object');
        }

        if (body?.decline !== undefined && typeof body.decline !== 'boolean') {
          throw new DomainError('VALIDATION', 'decline must be true or false');
        }

        const booking = await payForBooking(
          repository,
          paymentGateway,
          requireUserId(request),
          params.reference,
          { decline: body?.decline ?? false },
        );
        return respond(200, booking);
      },
    )
    .add(
      'POST',
      '/api/bookings/:reference/cancel',
      async ({ request, params }) =>
        respond(
          200,
          await cancelBooking(
            repository,
            requireUserId(request),
            params.reference,
          ),
        ),
    );

  return router;
}
