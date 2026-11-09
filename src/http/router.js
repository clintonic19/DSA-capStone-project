function compilePath(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new TypeError('Route paths must be strings beginning with /');
  }

  const segments = path.split('/');
  const parameterNames = [];

  for (const segment of segments) {
    if (segment.startsWith(':')) {
      const name = segment.slice(1);

      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new TypeError(`Invalid route parameter: ${segment}`);
      }

      if (parameterNames.includes(name)) {
        throw new TypeError(`Duplicate route parameter: ${name}`);
      }

      parameterNames.push(name);
    }
  }

  return { segments, parameterNames };
}

export function createRouter() {
  const routes = [];

  return {
    add(method, path, handler) {
      if (typeof method !== 'string' || typeof handler !== 'function') {
        throw new TypeError('Routes require a method and a handler');
      }

      const normalizedMethod = method.toUpperCase();
      const compiled = compilePath(path);

      if (
        routes.some(
          (route) =>
            route.method === normalizedMethod && route.path === path,
        )
      ) {
        throw new TypeError(`Duplicate route: ${normalizedMethod} ${path}`);
      }

      routes.push({
        method: normalizedMethod,
        path,
        handler,
        ...compiled,
      });

      return this;
    },

    match(method, pathname) {
      const normalizedMethod = method.toUpperCase();
      const requestSegments = pathname.split('/');

      for (const route of routes) {
        if (
          route.method !== normalizedMethod ||
          route.segments.length !== requestSegments.length
        ) {
          continue;
        }

        const params = {};
        let matches = true;
        let parameterIndex = 0;

        for (let index = 0; index < route.segments.length; index += 1) {
          const routeSegment = route.segments[index];
          const requestSegment = requestSegments[index];

          if (routeSegment.startsWith(':')) {
            try {
              params[route.parameterNames[parameterIndex]] =
                decodeURIComponent(requestSegment);
            } catch {
              matches = false;
              break;
            }
            parameterIndex += 1;
          } else if (routeSegment !== requestSegment) {
            matches = false;
            break;
          }
        }

        if (matches) {
          return { handler: route.handler, params };
        }
      }

      return undefined;
    },
  };
}
