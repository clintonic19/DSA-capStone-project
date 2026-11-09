import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../src/http/router.js';

test('router matches a method and extracts named path parameters', () => {
  const handler = () => 'ok';
  const router = createRouter().add(
    'GET',
    '/events/:eventId/bookings/:bookingId',
    handler,
  );

  assert.deepEqual(
    router.match('get', '/events/event-1/bookings/booking-2'),
    {
      handler,
      params: { eventId: 'event-1', bookingId: 'booking-2' },
    },
  );
});

test('router decodes path parameters and does not mutate registered routes', () => {
  const router = createRouter().add('GET', '/events/:eventId', () => {});

  assert.deepEqual(router.match('GET', '/events/event%201').params, {
    eventId: 'event 1',
  });
  assert.deepEqual(router.match('GET', '/events/event-2').params, {
    eventId: 'event-2',
  });
});

test('router does not match a different method or path shape', () => {
  const router = createRouter().add('GET', '/events/:eventId', () => {});

  assert.equal(router.match('POST', '/events/event-1'), undefined);
  assert.equal(router.match('GET', '/events/event-1/tickets'), undefined);
});
