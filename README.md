# @frontend-testing/server-stubs

Decoupled MSW stubbing for Vitest. One-liner JSON response mocks with built-in request spies.

## Features

- 🎯 **Zero Boilerplate** - One-liner to stub any endpoint with automatic request capture
- 🔍 **Built-in Spies** - Track all requests with parsed bodies, headers, and params
- 🔄 **Sequential Responses** - Simulate retries, pagination, or state changes
- 🎭 **Dynamic Responses** - Compute responses based on request data
- 📦 **TypeScript** - Full type support

## Installation

```bash
npm install -D @frontend-testing/server-stubs
```

**Peer Dependencies:** `msw >= 2.0.0`, `vitest >= 3.0.0`

## Quick Start

### 1. Configure MSW Server

```typescript
// src/test/setup.ts
import { setupWorker } from "msw/browser"; // or setupServer from "msw/node"
import { serverManager } from "@frontend-testing/server-stubs";
import { beforeAll, afterEach, afterAll } from "vitest";

const server = setupWorker();

serverManager.setDefaultServerLoader(() => server);

beforeAll(() => server.start({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.stop());
```

### 2. Use in Tests

```typescript
import { stubJsonResponse } from "@frontend-testing/server-stubs";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("LoginForm", () => {
  it("sends credentials and handles success", async () => {
    const { spy } = stubJsonResponse({
      path: "*/api/auth/login",
      method: "POST",
      response: { token: "jwt-token", user: { id: 1, name: "John" } },
    });

    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText("Email"), "john@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].body).toEqual({
      email: "john@example.com",
      password: "secret123",
    });
  });

  it("displays error on 401", async () => {
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

## API

### `stubJsonResponse(options)`

Creates a handler that intercepts matching requests and returns a JSON response.

```typescript
const { spy } = stubJsonResponse({
  path: "*/api/users",      // URL pattern (supports MSW wildcards)
  method: "POST",            // GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD, ALL
  response: { id: 1 },       // Static value or (ctx) => value
  status: 200,               // Static number or (ctx) => number
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `path` | `string` | required | URL pattern to match |
| `method` | `HttpMethod` | `"GET"` | HTTP method |
| `response` | `unknown \| (ctx) => unknown` | `undefined` | Response body |
| `status` | `number \| (ctx) => number` | `200` | HTTP status code |
| `responses` | `SequentialResponse[]` | - | Sequential responses |

### Request Spy

Every stub returns a `spy` that captures request details:

```typescript
const { spy } = stubJsonResponse({ path: "*/api/users", response: [] });

await fetch("/api/users?page=1", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "John" }),
});

const call = spy.mock.calls[0][0];
call.url;      // Full request URL
call.method;   // "POST"
call.body;     // { name: "John" } (auto-parsed)
call.headers;  // { "content-type": "application/json", ... }
call.params;   // { id: "123" } for /users/:id patterns
call.request;  // Original Request object
```

### Body Parsing

Request bodies are automatically parsed based on `Content-Type`:

| Content-Type | Parsed As |
|--------------|-----------|
| `application/json` | JavaScript object |
| `application/x-www-form-urlencoded` | Object from key-value pairs |
| `multipart/form-data` | Object with `File` instances |
| No header / Unknown | Attempts JSON, falls back to raw text |

### Dynamic Responses

Use functions to compute responses based on request data:

```typescript
stubJsonResponse({
  path: "*/api/echo",
  method: "POST",
  response: (ctx) => ({ received: ctx.body }),
  status: (ctx) => ctx.body?.valid ? 200 : 400,
});
```

**Response Context:**

```typescript
interface ResponseContext {
  url: string;
  method: string;
  body?: unknown;
  headers: Record<string, string>;
  params?: Record<string, string>;
  callIndex: number; // 0-based call counter
}
```

### Sequential Responses

Simulate retry logic or state changes across multiple calls:

```typescript
stubJsonResponse({
  path: "*/api/flaky",
  responses: [
    { response: { error: "Service unavailable" }, status: 503 },
    { response: { error: "Service unavailable" }, status: 503 },
    { response: { data: "Success!" }, status: 200 },
  ],
});

// 1st call → 503
// 2nd call → 503
// 3rd+ calls → 200 (repeats last response)
```

### `serverManager`

Singleton for MSW server management. Configure once, use stubs anywhere.

```typescript
import { serverManager } from "@frontend-testing/server-stubs";

// Set server directly
serverManager.setServer(myServer);

// Or lazy load (recommended)
serverManager.setDefaultServerLoader(() => myServer);

// Access
serverManager.getServer();
serverManager.hasServer();
serverManager.reset();
```

## Advanced Examples

### File Uploads

```typescript
const { spy } = stubJsonResponse({
  path: "*/api/upload",
  method: "POST",
  response: { id: "file-123" },
});

const formData = new FormData();
formData.append("file", new File(["content"], "doc.pdf"));

await fetch("/api/upload", { method: "POST", body: formData });

const body = spy.mock.calls[0][0].body as Record<string, unknown>;
expect(body.file).toBeInstanceOf(File);
```

### Catch-All Handler

```typescript
stubJsonResponse({
  path: "*/api/flexible",
  method: "ALL",
  response: (ctx) => ({ method: ctx.method }),
});
```

### Multiple Endpoints

```typescript
const usersSpy = stubJsonResponse({
  path: "*/api/users",
  response: [{ id: 1, name: "John" }],
});

const statsSpy = stubJsonResponse({
  path: "*/api/stats",
  response: { visits: 1000 },
});
```

## TypeScript

All types are exported:

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

## How It Works

This library wraps MSW's request handlers with a cleaner API and automatic request tracking. When you call `stubJsonResponse()`, it:

1. Creates an MSW handler for the specified path/method
2. Parses incoming request bodies based on `Content-Type`
3. Records all requests to a Vitest spy
4. Returns the configured response (static, dynamic, or sequential)

The `serverManager` decouples MSW server setup from test files, so you configure it once in your test setup and use stubs anywhere without importing the server instance.

## License

MIT
