/**
 * Server Stubs - Decoupled MSW server management and JSON response stubbing
 *
 * This library provides utilities for managing MSW servers and stubbing
 * JSON responses in a decoupled way, without tight coupling to specific
 * server instances.
 *
 * @packageDocumentation
 */
export { serverManager } from "./server-manager.js";
export { stubJsonResponse } from "./stub-json-response.js";
export type {
  HttpMethod,
  MswServer,
  RequestCall,
  ResponseContext,
  ResponseProvider,
  SequentialResponse,
  StubJsonResponseOptions,
} from "./types.js";
