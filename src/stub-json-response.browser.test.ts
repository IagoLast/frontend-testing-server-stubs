import { setupWorker } from "msw/browser";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { serverManager } from "./server-manager";
import { stubJsonResponse } from "./stub-json-response";

const worker = setupWorker();

describe("stubJsonResponse", () => {
  beforeAll(async () => {
    serverManager.setServer(worker);
    await worker.start({ onUnhandledRequest: "error" });
  });

  afterEach(() => {
    worker.resetHandlers();
  });

  afterAll(async () => {
    worker.stop();
    serverManager.reset();
  });

  it("should return the stubbed response when a GET request is made", async () => {
    stubJsonResponse({
      path: "https://api.example.com/users",
      response: [{ id: 1, name: "John" }],
    });

    const response = await fetch("https://api.example.com/users");
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([{ id: 1, name: "John" }]);
  });

  it("should return the stubbed response when a POST request is made", async () => {
    stubJsonResponse({
      path: "https://api.example.com/users",
      method: "POST",
      response: { id: 1 },
    });

    const response = await fetch("https://api.example.com/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "John" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ id: 1 });
  });

  it("should return the custom status code when status option is provided", async () => {
    stubJsonResponse({
      path: "https://api.example.com/users/999",
      response: { error: "Not found" },
      status: 404,
    });

    const response = await fetch("https://api.example.com/users/999");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  it("should capture request details when the spy is used", async () => {
    const { spy } = stubJsonResponse({
      path: "https://api.example.com/users",
      method: "POST",
      response: { id: 1 },
    });

    await fetch("https://api.example.com/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token123",
      },
      body: JSON.stringify({ name: "John", email: "john@test.com" }),
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0][0];
    expect(call.url).toBe("https://api.example.com/users");
    expect(call.method).toBe("POST");
    expect(call.body).toEqual({ name: "John", email: "john@test.com" });
    expect(call.headers["authorization"]).toBe("Bearer token123");
  });

  it("should count each request when multiple requests are made", async () => {
    const { spy } = stubJsonResponse({
      path: "https://api.example.com/users",
      response: [],
    });

    await fetch("https://api.example.com/users");
    await fetch("https://api.example.com/users");
    await fetch("https://api.example.com/users");

    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("should intercept requests when using wildcard paths", async () => {
    stubJsonResponse({
      path: "*/api/users",
      response: { wildcard: true },
    });

    const response = await fetch("https://any-domain.com/api/users");

    expect(await response.json()).toEqual({ wildcard: true });
  });

  it("should intercept requests when using any HTTP method", async () => {
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

    for (const method of methods) {
      stubJsonResponse({
        path: `https://api.example.com/${method.toLowerCase()}`,
        method,
        response: { method },
      });
    }

    for (const method of methods) {
      const response = await fetch(
        `https://api.example.com/${method.toLowerCase()}`,
        { method }
      );
      expect(await response.json()).toEqual({ method });
    }
  });

  it("should intercept OPTIONS requests", async () => {
    stubJsonResponse({
      path: "https://api.example.com/cors",
      method: "OPTIONS",
      response: { preflight: true },
    });

    const response = await fetch("https://api.example.com/cors", {
      method: "OPTIONS",
    });
    expect(await response.json()).toEqual({ preflight: true });
  });

  it("should intercept HEAD requests", async () => {
    stubJsonResponse({
      path: "https://api.example.com/head",
      method: "HEAD",
      response: {},
      status: 204,
    });

    const response = await fetch("https://api.example.com/head", {
      method: "HEAD",
    });
    expect(response.status).toBe(204);
  });

  it("should intercept ALL methods with a single handler", async () => {
    stubJsonResponse({
      path: "https://api.example.com/all",
      method: "ALL",
      response: { any: true },
    });

    const getResponse = await fetch("https://api.example.com/all");
    expect(await getResponse.json()).toEqual({ any: true });

    const postResponse = await fetch("https://api.example.com/all", {
      method: "POST",
    });
    expect(await postResponse.json()).toEqual({ any: true });
  });

  it("should parse application/x-www-form-urlencoded body", async () => {
    const { spy } = stubJsonResponse({
      path: "https://api.example.com/form",
      method: "POST",
      response: { ok: true },
    });

    await fetch("https://api.example.com/form", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=John&age=30",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0][0];
    expect(call.body).toEqual({ name: "John", age: "30" });
  });

  it("should parse multipart/form-data body", async () => {
    const { spy } = stubJsonResponse({
      path: "https://api.example.com/upload",
      method: "POST",
      response: { ok: true },
    });

    const formData = new FormData();
    formData.append("name", "John");
    formData.append("file", new Blob(["content"]), "test.txt");

    await fetch("https://api.example.com/upload", {
      method: "POST",
      body: formData,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0][0];
    expect((call.body as Record<string, unknown>).name).toBe("John");
    expect((call.body as Record<string, unknown>).file).toBeInstanceOf(File);
  });

  it("should expose original request in spy call", async () => {
    const { spy } = stubJsonResponse({
      path: "https://api.example.com/request",
      response: { ok: true },
    });

    await fetch("https://api.example.com/request");

    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0][0];
    expect(call.request).toBeInstanceOf(Request);
    expect(call.request.url).toBe("https://api.example.com/request");
  });

  it("should support dynamic response based on request", async () => {
    stubJsonResponse({
      path: "https://api.example.com/echo",
      method: "POST",
      response: (ctx) => ({ echo: ctx.body }),
    });

    const response = await fetch("https://api.example.com/echo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });

    expect(await response.json()).toEqual({ echo: { message: "hello" } });
  });

  it("should support dynamic status based on request", async () => {
    stubJsonResponse({
      path: "https://api.example.com/conditional",
      method: "POST",
      response: {},
      status: (ctx) =>
        (ctx.body as { valid?: boolean })?.valid ? 200 : 400,
    });

    const validResponse = await fetch("https://api.example.com/conditional", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valid: true }),
    });
    expect(validResponse.status).toBe(200);

    const invalidResponse = await fetch("https://api.example.com/conditional", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valid: false }),
    });
    expect(invalidResponse.status).toBe(400);
  });

  it("should support sequential responses for retry logic", async () => {
    stubJsonResponse({
      path: "https://api.example.com/retry",
      responses: [
        { response: { error: "timeout" }, status: 503 },
        { response: { error: "timeout" }, status: 503 },
        { response: { data: "success" }, status: 200 },
      ],
    });

    const first = await fetch("https://api.example.com/retry");
    expect(first.status).toBe(503);

    const second = await fetch("https://api.example.com/retry");
    expect(second.status).toBe(503);

    const third = await fetch("https://api.example.com/retry");
    expect(third.status).toBe(200);
    expect(await third.json()).toEqual({ data: "success" });

    // Fourth call should repeat last response
    const fourth = await fetch("https://api.example.com/retry");
    expect(fourth.status).toBe(200);
  });

  it("should provide callIndex in response context", async () => {
    const { spy } = stubJsonResponse({
      path: "https://api.example.com/indexed",
      response: (ctx) => ({ index: ctx.callIndex }),
    });

    const first = await fetch("https://api.example.com/indexed");
    expect(await first.json()).toEqual({ index: 0 });

    const second = await fetch("https://api.example.com/indexed");
    expect(await second.json()).toEqual({ index: 1 });

    expect(spy).toHaveBeenCalledTimes(2);
  });
});
