import { http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { serverManager } from "./server-manager";

const worker = setupWorker();

describe("serverManager", () => {
  beforeAll(async () => {
    await worker.start({ onUnhandledRequest: "error" });
  });

  beforeEach(() => {
    serverManager.reset();
  });

  afterEach(() => {
    worker.resetHandlers();
  });

  afterAll(() => {
    worker.stop();
  });

  it("should intercept requests when setServer is called with a real server", async () => {
    serverManager.setServer(worker);
    worker.use(
      http.get("https://api.example.com/test", () => {
        return HttpResponse.json({ intercepted: true });
      })
    );

    const response = await fetch("https://api.example.com/test");
    const data = await response.json();

    expect(data).toEqual({ intercepted: true });
  });

  it("should intercept requests when setDefaultServerLoader is called", async () => {
    serverManager.setDefaultServerLoader(() => worker);
    worker.use(
      http.get("https://api.example.com/loader-test", () => {
        return HttpResponse.json({ fromLoader: true });
      })
    );

    const response = await fetch("https://api.example.com/loader-test");
    const data = await response.json();

    expect(data).toEqual({ fromLoader: true });
  });

  it("should return the same server instance when getServer is called multiple times", () => {
    serverManager.setServer(worker);

    const server1 = serverManager.getServer();
    const server2 = serverManager.getServer();

    expect(server1).toBe(server2);
  });

  it("should throw an error when no server is configured", () => {
    expect(() => serverManager.getServer()).toThrow(
      "No MSW server configured. Call serverManager.setServer() or serverManager.setDefaultServerLoader() first."
    );
  });

  it("should throw an error when reset is called after setting a server", () => {
    serverManager.setServer(worker);

    serverManager.reset();

    expect(() => serverManager.getServer()).toThrow();
  });
});


