import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSort } from '../src/domain/sorting.js';

test('mergeSort returns a new sorted array', () => {
  const input = [3, 1, 2];

  const result = mergeSort(input, (left, right) => left - right);

  assert.deepEqual(result, [1, 2, 3]);
  assert.notEqual(result, input);
  assert.deepEqual(input, [3, 1, 2]);
});

test('mergeSort is stable for equal items', () => {
  const input = [
    { key: 1, name: 'first' },
    { key: 0, name: 'second' },
    { key: 1, name: 'third' },
    { key: 0, name: 'fourth' },
    { key: 1, name: 'fifth' },
  ];

  const result = mergeSort(input, (left, right) => left.key - right.key);

  assert.deepEqual(
    result.map((item) => item.name),
    ['second', 'fourth', 'first', 'third', 'fifth'],
  );
  assert.deepEqual(
    input.map((item) => item.name),
    ['first', 'second', 'third', 'fourth', 'fifth'],
  );
});

test('mergeSort handles an empty list and a single item', () => {
  const empty = [];
  const one = [{ id: 1 }];

  assert.deepEqual(mergeSort(empty, () => 0), []);
  assert.deepEqual(mergeSort(one, () => 0), one);
  assert.notEqual(mergeSort(one, () => 0), one);
});
