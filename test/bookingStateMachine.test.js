import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '../src/domain/errors.js';
import {
  assertTransition,
  BOOKING_STATES,
  BOOKING_TRANSITIONS,
  canTransition,
} from '../src/domain/bookingStateMachine.js';

test('every configured booking transition is allowed', () => {
  for (const [from, destinations] of Object.entries(BOOKING_TRANSITIONS)) {
    for (const to of destinations) {
      assert.equal(canTransition(from, to), true, `${from} -> ${to}`);
      assert.equal(assertTransition(from, to), undefined);
    }
  }
});

test('every other move between booking states is rejected', () => {
  const allowed = new Set(
    Object.entries(BOOKING_TRANSITIONS).flatMap(([from, destinations]) =>
      destinations.map((to) => `${from}:${to}`),
    ),
  );

  for (const from of BOOKING_STATES) {
    for (const to of BOOKING_STATES) {
      if (allowed.has(`${from}:${to}`)) {
        continue;
      }

      assert.equal(canTransition(from, to), false, `${from} -> ${to}`);
      assert.throws(
        () => assertTransition(from, to),
        (error) =>
          error instanceof DomainError &&
          error.code === 'INVALID_TRANSITION',
      );
    }
  }
});

test('unknown states cannot transition', () => {
  assert.equal(canTransition('unknown', 'pending'), false);
  assert.throws(
    () => assertTransition('unknown', 'pending'),
    (error) => error.code === 'INVALID_TRANSITION',
  );
});
