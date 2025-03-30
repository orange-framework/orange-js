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
