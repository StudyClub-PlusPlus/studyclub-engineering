import { http, HttpResponse } from 'msw';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type MockResolveContext = {
  request: Request;
  params: Record<string, string | string[]>;
};

export type MockPreset<T = unknown> = {
  label: string;
  status: number;
  response: T | ((ctx: MockResolveContext) => T | Response | Promise<T | Response>);
};

export type MockHandler = {
  method: HttpMethod;
  path: string;
  presets: [MockPreset, ...MockPreset[]];
};

export type MockHandlerGroup = {
  baseUrl: string;
  handlers: MockHandler[];
};

export const handlerKey = (h: { method: string; path: string }) => `${h.method}:${h.path}`;

export const matchHandler = (
  a: { method: string; path: string },
  b: { method: string; path: string },
) => handlerKey(a) === handlerKey(b);

const methodFnMap = {
  GET: http.get,
  POST: http.post,
  PUT: http.put,
  DELETE: http.delete,
  PATCH: http.patch,
} as const;

export type ActiveHandler = MockHandler & { preset: MockPreset };

const DEFAULT_API_HOST = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

export const registerHandlers = (activeHandlers: ActiveHandler[]) =>
  activeHandlers.flatMap(({ method, path, preset }) => {
    const resolver = async ({ request, params }: { request: Request; params: any }) => {
      if (typeof preset.response !== 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return HttpResponse.json(preset.response as any, { status: preset.status });
      }
      const result = await preset.response({
        request,
        params: params as Record<string, string | string[]>,
      });
      if (result instanceof Response) return result;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return HttpResponse.json(result as any, { status: preset.status });
    };

    const paths = path.startsWith('/') ? [path, `${DEFAULT_API_HOST}${path}`] : [path];
    return paths.map((p) => methodFnMap[method](p, resolver));
  });

export const mockClient = {
  createHandlerGroup: (baseUrl: string, handlers: MockHandler[]): MockHandlerGroup => {
    const base = `${API_BASE}${baseUrl}`;
    return {
      baseUrl: base,
      handlers: handlers.map((h) => ({
        ...h,
        path: h.path === '/' ? base : `${base}${h.path}`,
      })),
    };
  },
};
