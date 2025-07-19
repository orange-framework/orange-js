export type Route = {
  pattern: URLPattern;
};

export function router<T extends Route>(
  routes: T[]
): (request: Request) => T | undefined {
  return (request: Request) => {
    const url = new URL(request.url);
    return routes.find((route) => route.pattern.test(url));
  };
}
