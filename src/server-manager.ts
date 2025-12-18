import type { MswServer } from "./types.js";

let serverInstance: MswServer | null = null;
let defaultServerLoader: (() => MswServer) | null = null;

/**
 * Server manager for MSW server instances.
 * Provides a singleton pattern to manage and inject MSW servers
 * without tight coupling.
 */
export const serverManager = {
  /**
   * Register a function that will be called to get the default server
   * if no server has been explicitly set.
   *
   * @param loader - Function that returns the default MSW server instance
   */
  setDefaultServerLoader(loader: () => MswServer): void {
    defaultServerLoader = loader;
  },

  /**
   * Get the current server instance.
   * Will use the default loader if no server has been explicitly set.
   *
   * @returns The MSW server instance
   * @throws Error if no server has been configured
   */
  getServer(): MswServer {
    if (!serverInstance) {
      if (defaultServerLoader) {
        serverInstance = defaultServerLoader();
      } else {
        throw new Error(
          "No MSW server configured. Call serverManager.setServer() or serverManager.setDefaultServerLoader() first."
        );
      }
    }
    return serverInstance;
  },

  /**
   * Set the server instance to use.
   *
   * @param server - The MSW server instance
   */
  setServer(server: MswServer): void {
    serverInstance = server;
  },

  /**
   * Check if a server has been configured.
   *
   * @returns true if a server instance is available
   */
  hasServer(): boolean {
    return serverInstance !== null || defaultServerLoader !== null;
  },

  /**
   * Reset the server instance (useful for testing).
   */
  reset(): void {
    serverInstance = null;
    defaultServerLoader = null;
  },
};
