export function mergeSort(items, compare) {
  if (items.length <= 1) {
    return items.slice();
  }

  const middle = Math.floor(items.length / 2);
  const left = mergeSort(items.slice(0, middle), compare);
  const right = mergeSort(items.slice(middle), compare);

  return merge(left, right, compare);
}

function merge(left, right, compare) {
  const result = new Array(left.length + right.length);
  let leftIndex = 0;
  let rightIndex = 0;
  let resultIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (compare(left[leftIndex], right[rightIndex]) <= 0) {
      result[resultIndex] = left[leftIndex];
      leftIndex += 1;
    } else {
      result[resultIndex] = right[rightIndex];
      rightIndex += 1;
    }

    resultIndex += 1;
  }

  while (leftIndex < left.length) {
    result[resultIndex] = left[leftIndex];
    leftIndex += 1;
    resultIndex += 1;
  }

  while (rightIndex < right.length) {
    result[resultIndex] = right[rightIndex];
    rightIndex += 1;
    resultIndex += 1;
  }

  return result;
}
