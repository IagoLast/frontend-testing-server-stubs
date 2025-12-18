import { http, HttpResponse, type JsonBodyType } from "msw";
import { vi, type Mock } from "vitest";
import { serverManager } from "./server-manager.js";
import type {
  HttpMethod,
  RequestCall,
  ResponseContext,
  ResponseProvider,
  StubJsonResponseOptions,
} from "./types.js";

const httpMethods: Record<HttpMethod, typeof http.get> = {
  GET: http.get,
  POST: http.post,
  PUT: http.put,
  PATCH: http.patch,
  DELETE: http.delete,
  OPTIONS: http.options,
  HEAD: http.head,
  ALL: http.all,
};

/**
 * Parse request body based on content-type header
 */
async function parseBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      return await request.json();
    }

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await request.text();
      return Object.fromEntries(new URLSearchParams(text));
    }

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const result: Record<string, FormDataEntryValue | FormDataEntryValue[]> =
        {};
      formData.forEach((value, key) => {
        if (key in result) {
          const existing = result[key];
          result[key] = Array.isArray(existing)
            ? [...existing, value]
            : [existing, value];
        } else {
          result[key] = value;
        }
      });
      return result;
    }

    // Fallback: try JSON anyway for requests without content-type
    const text = await request.text();
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
  } catch {
    // Body parsing failed
  }
  return undefined;
}

/**
 * Resolve a response provider (static or dynamic)
 */
function resolveProvider<T>(provider: ResponseProvider<T>, ctx: ResponseContext): T {
  return typeof provider === "function"
    ? (provider as (ctx: ResponseContext) => T)(ctx)
    : provider;
}

/**
 * Stub a JSON response for a given path and HTTP method.
 * Returns a spy function that captures all requests matching the pattern.
 */
export function stubJsonResponse({
  path,
  method = "GET",
  response,
  status = 200,
  responses,
}: StubJsonResponseOptions): {
  spy: Mock<(call: RequestCall) => void>;
} {
  const spy = vi.fn<(call: RequestCall) => void>();
  let callIndex = 0;

  const httpMethod = httpMethods[method];
  const handler = httpMethod(path, async ({ request, params }) => {
    const body = await parseBody(request);

    const headers: Record<string, string> = {};
    request.headers.forEach((value: string, key: string) => {
      headers[key] = value;
    });

    const ctx: ResponseContext = {
      url: request.url,
      method: request.method,
      body,
      headers,
      params: params as Record<string, string>,
      callIndex,
    };

    spy({
      ...ctx,
      request,
    });

    let finalResponse: unknown;
    let finalStatus: number;

    if (responses && responses.length > 0) {
      // Sequential responses: use callIndex, clamp to last response
      const idx = Math.min(callIndex, responses.length - 1);
      finalResponse = responses[idx].response;
      finalStatus = responses[idx].status ?? 200;
    } else {
      finalResponse = resolveProvider(response, ctx);
      finalStatus = resolveProvider(status, ctx);
    }

    callIndex++;

    return HttpResponse.json(finalResponse as JsonBodyType, {
      status: finalStatus,
    });
  });

  serverManager.getServer().use(handler);

  return { spy };
}
