import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/http/app.js';

async function withApi(callback, options) {
  const server = createApp(options);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function post(baseUrl, route, { userId, body } = {}) {
  const headers = {};

  if (userId) {
    headers['x-user-id'] = userId;
  }

  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  return fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('API creates, publishes, searches, books, pays and cancels using real HTTP', async () => {
  let chargeCount = 0;

  await withApi(async (baseUrl) => {
    const createdResponse = await post(baseUrl, '/api/events', {
      userId: 'organizer-1',
      body: {
        title: 'Lagos Tech Meetup',
        city: 'Lagos',
        venue: 'Yaba Hub',
        startsAt: '2027-12-05T17:00:00Z',
      },
    });
    assert.equal(createdResponse.status, 201);
    const event = await createdResponse.json();
    assert.equal(event.status, 'draft');
    assert.equal(event.organizerId, 'organizer-1');

    const tierResponse = await post(
      baseUrl,
      `/api/events/${event.id}/tiers`,
      {
        userId: 'organizer-1',
        body: { name: 'General', priceCents: 500000, capacity: 3 },
      },
    );
    assert.equal(tierResponse.status, 201);
    const tier = await tierResponse.json();

    const publishResponse = await post(
      baseUrl,
      `/api/events/${event.id}/publish`,
      { userId: 'organizer-1' },
    );
    assert.equal(publishResponse.status, 200);
    assert.equal((await publishResponse.json()).status, 'published');

    const searchResponse = await fetch(
      `${baseUrl}/api/events?q=MEETUP&city=lagos&sortBy=price`,
    );
    assert.equal(searchResponse.status, 200);
    assert.equal((await searchResponse.json())[0].id, event.id);

    const bookingResponse = await post(baseUrl, '/api/bookings', {
      userId: 'attendee-1',
      body: { tierId: tier.id, quantity: 2 },
    });
    assert.equal(bookingResponse.status, 201);
    const booking = await bookingResponse.json();
    assert.equal(booking.status, 'pending');
    assert.equal(booking.amountCents, 1000000);

    const paidResponse = await post(
      baseUrl,
      `/api/bookings/${booking.reference}/pay`,
      { userId: 'attendee-1', body: {} },
    );
    assert.equal(paidResponse.status, 200);
    assert.equal((await paidResponse.json()).status, 'paid');

    const repeatPaymentResponse = await post(
      baseUrl,
      `/api/bookings/${booking.reference}/pay`,
      { userId: 'attendee-1', body: {} },
    );
    assert.equal(repeatPaymentResponse.status, 409);
    assert.equal(
      (await repeatPaymentResponse.json()).error.code,
      'INVALID_TRANSITION',
    );

    const secondBookingResponse = await post(baseUrl, '/api/bookings', {
      userId: 'attendee-2',
      body: { tierId: tier.id, quantity: 1 },
    });
    assert.equal(secondBookingResponse.status, 201);
    const secondBooking = await secondBookingResponse.json();

    const unpaidCancelResponse = await post(
      baseUrl,
      `/api/bookings/${secondBooking.reference}/cancel`,
      { userId: 'attendee-2' },
    );
    assert.equal(unpaidCancelResponse.status, 200);
    assert.equal((await unpaidCancelResponse.json()).status, 'cancelled');

    const cancelledPaymentResponse = await post(
      baseUrl,
      `/api/bookings/${secondBooking.reference}/pay`,
      { userId: 'attendee-2', body: {} },
    );
    assert.equal(cancelledPaymentResponse.status, 409);
    assert.equal(
      (await cancelledPaymentResponse.json()).error.code,
      'INVALID_TRANSITION',
    );

    const rebookResponse = await post(baseUrl, '/api/bookings', {
      userId: 'attendee-3',
      body: { tierId: tier.id, quantity: 1 },
    });
    assert.equal(rebookResponse.status, 201);

    const cancelResponse = await post(
      baseUrl,
      `/api/bookings/${booking.reference}/cancel`,
      { userId: 'attendee-1' },
    );
    assert.equal(cancelResponse.status, 409);
    assert.equal((await cancelResponse.json()).error.code, 'INVALID_TRANSITION');
  }, {
    paymentGateway: {
      async charge({ amountCents, bookingReference }) {
        assert.equal(typeof amountCents, 'number');
        assert.equal(typeof bookingReference, 'string');
        chargeCount += 1;
        return { success: true };
      },
    },
  });

  assert.equal(chargeCount, 1);
});

test('declined payment leaves booking pending and only its owner can pay', async () => {
  await withApi(async (baseUrl) => {
    const event = await (
      await post(baseUrl, '/api/events', {
        userId: 'organizer-1',
        body: {
          title: 'Abuja Jazz Night',
          city: 'Abuja',
          startsAt: '2027-12-06T17:00:00Z',
        },
      })
    ).json();
    const tier = await (
      await post(baseUrl, `/api/events/${event.id}/tiers`, {
        userId: 'organizer-1',
        body: { name: 'Standard', priceCents: 2500, capacity: 2 },
      })
    ).json();
    await post(baseUrl, `/api/events/${event.id}/publish`, {
      userId: 'organizer-1',
    });
    const booking = await (
      await post(baseUrl, '/api/bookings', {
        userId: 'attendee-1',
        body: { tierId: tier.id, quantity: 1 },
      })
    ).json();

    const otherUserResponse = await post(
      baseUrl,
      `/api/bookings/${booking.reference}/pay`,
      { userId: 'attendee-2', body: {} },
    );
    assert.equal(otherUserResponse.status, 403);
    assert.equal((await otherUserResponse.json()).error.code, 'FORBIDDEN');

    const declinedResponse = await post(
      baseUrl,
      `/api/bookings/${booking.reference}/pay`,
      { userId: 'attendee-1', body: { decline: true } },
    );
    assert.equal(declinedResponse.status, 400);
    assert.equal((await declinedResponse.json()).error.code, 'PAYMENT_DECLINED');

    const retryResponse = await post(
      baseUrl,
      `/api/bookings/${booking.reference}/pay`,
      { userId: 'attendee-1', body: {} },
    );
    assert.equal(retryResponse.status, 200);
    assert.equal((await retryResponse.json()).status, 'paid');
  });
});

test('API returns consistent JSON errors for missing identity, invalid input and missing routes', async () => {
  await withApi(async (baseUrl) => {
    const missingIdentity = await post(baseUrl, '/api/events', {
      body: {
        title: 'Event',
        city: 'Lagos',
        startsAt: '2027-12-05T17:00:00Z',
      },
    });
    assert.equal(missingIdentity.status, 401);
    assert.deepEqual(await missingIdentity.json(), {
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'x-user-id header is required',
      },
    });

    const badInput = await post(baseUrl, '/api/events', {
      userId: 'organizer-1',
      body: { title: '', city: 'Lagos', startsAt: 'not-a-date' },
    });
    assert.equal(badInput.status, 400);
    assert.equal((await badInput.json()).error.code, 'VALIDATION');

    const unknownApi = await fetch(`${baseUrl}/api/missing`);
    assert.equal(unknownApi.status, 404);
    assert.deepEqual(await unknownApi.json(), {
      error: { code: 'NOT_FOUND', message: 'API route not found' },
    });
  });
});
