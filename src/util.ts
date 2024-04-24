export function unwrap<T>(input: T | null | undefined): T {
  if (input === null || input === undefined) {
    throw new Error('Failed to unwrap optional value');
  }
  return input;
}

export function notNullOrUndefined<T>(input: T | null | undefined): input is T {
  return input !== null && input !== undefined;
}

export function uniqueValues<T>(input: T[]): T[] {
  const set = new Set<T>(input);
  return Array.from(set);
}

export function groupItemsBy<TInput, TKey extends string, TOutput>(
  items: TInput[],
  grouper: (item: TInput) => TKey,
  valueSelector: (item: TInput) => TOutput
) {
  return items.reduce((result, item) => {
    const groupKey = grouper(item);
    if (result[groupKey]) {
      result[groupKey].push(valueSelector(item));
    } else {
      result[groupKey] = [valueSelector(item)];
    }
    return result;
  }, {} as { [group in TKey]: TOutput[] });
}

export function toDictionary<T, V>(
  items: T[],
  keySelector: (item: T, index: number) => string,
  valueSelector: (item: T, index: number) => V
) {
  return items.reduce((result, item, index) => {
    if (result[keySelector(item, index)]) {
      throw new Error('Duplicate keys found while creating dictionary');
    }
    result[keySelector(item, index)] = valueSelector(item, index);
    return result;
  }, {} as { [key: string]: V });
}

export function assertUnreachable(_: never): never {
  throw new Error('Unreachable code assertion failed');
}
