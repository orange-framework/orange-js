export function unreachable(): never {
  throw new Error("unreachable");
}

export function bail(message: string): never {
  throw new Error(message);
}

export function assert<T>(
  whatever: T,
  message = "assertion failed",
): asserts whatever {
  if (!whatever) {
    throw new Error(message);
  }
}

export function mapObject<
  K extends string | number | symbol,
  V,
  NK extends string | number | symbol = K,
  NV = V,
>(
  obj: Record<K, V>,
  mapVal: (val: V) => NV,
  mapKey: (key: K) => NK = (key) => key as unknown as NK,
): Record<NK, NV> {
  const newObj = {} as Record<NK, NV>;
  for (const key in obj) {
    const newKey = mapKey(key);
    newObj[newKey] = mapVal(obj[key]);
  }
  return newObj;
}

export function isEcmaLike(file: string) {
  return (
    file.endsWith(".tsx") ||
    file.endsWith(".jsx") ||
    file.endsWith(".ts") ||
    file.endsWith(".js")
  );
}
