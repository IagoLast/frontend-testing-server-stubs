import type { RequestHandler } from "msw";

/**
 * HTTP methods supported by stubJsonResponse
 */
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD"
  | "ALL";

/**
 * Information about a request call captured by the spy
 */
export interface RequestCall {
  /** Full request URL */
  url: string;
  /** HTTP method */
  method: string;
  /** Request body (parsed based on content-type) */
  body?: unknown;
  /** Request headers */
  headers: Record<string, string>;
  /** URL path parameters */
  params?: Record<string, string>;
  /** Original MSW Request object for edge cases */
  request: Request;
}

/**
 * Context passed to dynamic response/status functions
 */
export interface ResponseContext {
  /** Full request URL */
  url: string;
  /** HTTP method */
  method: string;
  /** Request body (parsed based on content-type) */
  body?: unknown;
  /** Request headers */
  headers: Record<string, string>;
  /** URL path parameters */
  params?: Record<string, string>;
  /** Call index (0-based, useful for sequential responses) */
  callIndex: number;
}

/**
 * Response provider: static value or dynamic function
 */
export type ResponseProvider<T> = T | ((ctx: ResponseContext) => T);

/**
 * Sequential response configuration
 */
export interface SequentialResponse {
  response: unknown;
  status?: number;
}

/**
 * Options for configuring a stubbed JSON response
 */
export interface StubJsonResponseOptions {
  /** URL path pattern to match (supports wildcards like /api/users/*) */
  path: string;
  /** HTTP method to match (default: GET) */
  method?: HttpMethod;
  /** Response body to return (static or dynamic) */
  response?: ResponseProvider<unknown>;
  /** HTTP status code to return (static or dynamic, default: 200) */
  status?: ResponseProvider<number>;
  /** Sequential responses for retry logic (overrides response/status) */
  responses?: SequentialResponse[];
}

/**
 * Minimal interface for MSW server/worker.
 * Works with both setupWorker (browser) and setupServer (node).
 */
export interface MswServer {
  use(...handlers: RequestHandler[]): void;
}
