# @frontend-testing/server-stubs

Decoupled MSW server management and JSON response stubbing for testing.

## The Problem

Testing frontend code that makes API calls typically requires:

1. **Setting up MSW** in every test file or importing a shared server instance
2. **Writing verbose handlers** for each endpoint you want to mock
3. **Manually tracking requests** to verify your code called the API correctly
4. **Parsing request bodies** to assert on what was sent

This leads to repetitive boilerplate and tight coupling between tests and MSW setup.

## The Solution

`server-stubs` provides a clean, decoupled API that:

- **Eliminates boilerplate** — One-liner to stub any endpoint
- **Auto-captures requests** — Built-in spy tracks all calls with parsed bodies
- **Decouples server management** — Inject MSW server once, use stubs anywhere
- **Supports dynamic responses** — Conditional logic, retry simulation, and more

```typescript
// Before: Verbose MSW setup
server.use(
  http.post('*/api/login', async ({ request }) => {
    const body = await request.json();
    // manually track this somehow...
    return HttpResponse.json({ token: 'abc' });
  })
);

// After: One-liner with built-in spy
const { spy } = stubJsonResponse({
  path: '*/api/login',
  method: 'POST',
  response: { token: 'abc' },
});

expect(spy.mock.calls[0][0].body).toEqual({ email: 'test@test.com' });
```

## Installation

```bash
npm install --save-dev @frontend-testing/server-stubs
```

**Peer Dependencies:** `msw` (^2.0.0), `vitest` (>=3.0.0)

## Quick Start

### 1. Configure MSW Server (once)

```typescript
// src/test/setup.ts
import { setupWorker } from "msw/browser"; // or setupServer from "msw/node"
import { serverManager } from "@frontend-testing/server-stubs";
import { beforeAll, afterEach, afterAll } from "vitest";

const server = setupWorker();

// Register the server globally
serverManager.setDefaultServerLoader(() => server);

beforeAll(() => server.start({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.stop());
```

### 2. Stub Endpoints in Tests

```typescript
// src/features/auth/login.spec.ts
import { stubJsonResponse } from "@frontend-testing/server-stubs";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("LoginForm", () => {
  it("should send credentials and handle success", async () => {
    const { spy } = stubJsonResponse({
      path: "*/api/auth/login",
      method: "POST",
      response: { token: "jwt-token", user: { id: 1, name: "John" } },
    });

    render(<LoginForm />);
    
    await userEvent.type(screen.getByLabelText("Email"), "john@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    // Verify the API was called with correct data
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].body).toEqual({
      email: "john@example.com",
      password: "secret123",
    });

    // Verify UI updated
    await screen.findByText("Welcome, John!");
  });

  it("should display error on 401", async () => {
    stubJsonResponse({
      path: "*/api/auth/login",
      method: "POST",
      response: { error: "Invalid credentials" },
      status: 401,
    });

    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    await screen.findByText("Invalid credentials");
  });
});
```

## API Reference

### `stubJsonResponse(options)`

Creates a request handler that intercepts matching requests and returns a JSON response.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | `string` | required | URL pattern to match (supports MSW wildcards like `*/api/users/:id`) |
| `method` | `HttpMethod` | `"GET"` | HTTP method to match |
| `response` | `unknown \| (ctx) => unknown` | `undefined` | Response body (static or dynamic) |
| `status` | `number \| (ctx) => number` | `200` | HTTP status code (static or dynamic) |
| `responses` | `SequentialResponse[]` | - | Array of responses for sequential calls |

**Returns:** `{ spy: Mock }` — A Vitest mock function that captures all matching requests.

**Supported HTTP Methods:**

```typescript
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD" | "ALL";
```

Use `"ALL"` to match any HTTP method with a single handler.

### Request Spy

Every stub returns a `spy` that captures request details:

```typescript
const { spy } = stubJsonResponse({ path: "*/api/users", response: [] });

await fetch("https://api.example.com/api/users");

const call = spy.mock.calls[0][0];

call.url;      // "https://api.example.com/api/users"
call.method;   // "GET"
call.body;     // Parsed request body (see Body Parsing)
call.headers;  // { "content-type": "application/json", ... }
call.params;   // { id: "123" } for path params like /users/:id
call.request;  // Original Request object (for edge cases)
```

### Body Parsing

Request bodies are automatically parsed based on `Content-Type`:

| Content-Type | Parsed As |
|--------------|-----------|
| `application/json` | JavaScript object |
| `application/x-www-form-urlencoded` | Object from key-value pairs |
| `multipart/form-data` | Object with `File` instances |
| No header / Unknown | Attempts JSON, falls back to raw text |

```typescript
// JSON body
const { spy } = stubJsonResponse({ path: "*/api", method: "POST", response: {} });

await fetch("/api", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "John" }),
});

expect(spy.mock.calls[0][0].body).toEqual({ name: "John" });

// Form data
await fetch("/api", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: "name=John&age=30",
});

expect(spy.mock.calls[1][0].body).toEqual({ name: "John", age: "30" });
```

### Dynamic Responses

Pass functions to `response` or `status` to compute values based on the request:

```typescript
// Echo endpoint
stubJsonResponse({
  path: "*/api/echo",
  method: "POST",
  response: (ctx) => ({ received: ctx.body }),
});

// Conditional status based on request
stubJsonResponse({
  path: "*/api/validate",
  method: "POST",
  response: (ctx) => ctx.body?.valid ? { ok: true } : { error: "Invalid" },
  status: (ctx) => ctx.body?.valid ? 200 : 400,
});

// Use callIndex for request-dependent logic
stubJsonResponse({
  path: "*/api/counter",
  response: (ctx) => ({ count: ctx.callIndex + 1 }),
});
```

**Response Context:**

```typescript
interface ResponseContext {
  url: string;                       // Full request URL
  method: string;                    // HTTP method
  body?: unknown;                    // Parsed request body
  headers: Record<string, string>;   // Request headers
  params?: Record<string, string>;   // URL path parameters
  callIndex: number;                 // 0-based call counter
}
```

### Sequential Responses

Simulate retry logic or state changes across multiple calls:

```typescript
// Simulate a flaky endpoint that fails twice then succeeds
stubJsonResponse({
  path: "*/api/flaky",
  responses: [
    { response: { error: "Service unavailable" }, status: 503 },
    { response: { error: "Service unavailable" }, status: 503 },
    { response: { data: "Success!" }, status: 200 },
  ],
});

// First call → 503
// Second call → 503  
// Third call → 200
// Fourth+ calls → 200 (repeats last response)
```

This is perfect for testing retry logic, optimistic updates, or pagination.

### `serverManager`

Singleton manager for MSW server instances. Configure once, use stubs anywhere.

```typescript
import { serverManager } from "@frontend-testing/server-stubs";

// Option 1: Set server directly
serverManager.setServer(myServer);

// Option 2: Lazy loading (recommended for setup files)
serverManager.setDefaultServerLoader(() => myServer);

// Access the server
const server = serverManager.getServer();

// Check if configured
if (serverManager.hasServer()) { /* ... */ }

// Reset (useful in test teardown)
serverManager.reset();
```

## Advanced Patterns

### Testing File Uploads

```typescript
it("should upload a file", async () => {
  const { spy } = stubJsonResponse({
    path: "*/api/upload",
    method: "POST",
    response: { id: "file-123" },
  });

  const formData = new FormData();
  formData.append("file", new File(["content"], "doc.pdf"));
  formData.append("description", "My document");

  await fetch("/api/upload", { method: "POST", body: formData });

  const body = spy.mock.calls[0][0].body as Record<string, unknown>;
  expect(body.description).toBe("My document");
  expect(body.file).toBeInstanceOf(File);
  expect((body.file as File).name).toBe("doc.pdf");
});
```

### Testing CORS Preflight

```typescript
stubJsonResponse({
  path: "*/api/resource",
  method: "OPTIONS",
  response: null,
  status: 204,
});
```

### Catch-All Handler

```typescript
// Match any method on an endpoint
stubJsonResponse({
  path: "*/api/flexible",
  method: "ALL",
  response: (ctx) => ({ method: ctx.method }),
});
```

### Multiple Stubs in One Test

```typescript
it("should load dashboard data", async () => {
  const usersSpy = stubJsonResponse({
    path: "*/api/users",
    response: [{ id: 1, name: "John" }],
  });

  const statsSpy = stubJsonResponse({
    path: "*/api/stats",
    response: { visits: 1000 },
  });

  render(<Dashboard />);

  await waitFor(() => {
    expect(usersSpy).toHaveBeenCalled();
    expect(statsSpy).toHaveBeenCalled();
  });
});
```

## TypeScript

All types are exported for full type safety:

```typescript
import type {
  HttpMethod,
  RequestCall,
  ResponseContext,
  ResponseProvider,
  SequentialResponse,
  StubJsonResponseOptions,
  MswServer,
} from "@frontend-testing/server-stubs";
```

## License

MIT
