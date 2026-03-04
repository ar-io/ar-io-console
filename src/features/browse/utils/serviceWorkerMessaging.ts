export interface ServiceWorkerMessage {
  type: string;
  [key: string]: unknown;
}

export class ServiceWorkerMessenger {
  private listeners = new Map<
    string,
    Set<(data: ServiceWorkerMessage) => void>
  >();
  private messageListenerAttached = false;
  private registrationPromise: Promise<void> | null = null;
  private registration: ServiceWorkerRegistration | null = null;
  private updateAvailable = false;
  private updateCallbacks: Set<() => void> = new Set();

  /**
   * Proactively register service worker at app startup.
   * This ensures the SW is installed and controlling the page before verification is enabled.
   * Safe to call multiple times - will reuse existing registration.
   *
   * @param scriptURL - URL to the service worker script
   * @param options - Registration options (e.g., { type: 'module' } for ES module service workers)
   */
  async registerProactive(
    scriptURL: string,
    options?: RegistrationOptions,
  ): Promise<void> {
    // Reuse existing registration if in progress
    if (this.registrationPromise) {
      return this.registrationPromise;
    }

    this.registrationPromise = this.doRegister(scriptURL, options);
    return this.registrationPromise;
  }

  private async doRegister(
    scriptURL: string,
    options?: RegistrationOptions,
  ): Promise<void> {
    if (!("serviceWorker" in navigator)) {
      console.warn("[SW] Service workers not supported");
      return;
    }

    // Retry with exponential backoff
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Check if offline before attempting
        if (!navigator.onLine) {
          console.warn("[SW] Offline - deferring registration");
          // Wait for online event before continuing
          await this.waitForOnline(30000);
        }

        const registration = await navigator.serviceWorker.register(
          scriptURL,
          options,
        );
        console.log("[SW] Registered:", registration.scope);
        this.registration = registration;

        // Set up message listener (only once)
        if (!this.messageListenerAttached) {
          navigator.serviceWorker.addEventListener("message", (event) => {
            this.handleMessage(event.data);
          });
          this.messageListenerAttached = true;
        }

        // Listen for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                // New version available
                console.log("[SW] Update available");
                this.updateAvailable = true;
                this.updateCallbacks.forEach((cb) => cb());
              }
            });
          }
        });

        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;

        // Wait for controller with robust retry
        await this.waitForController();
        return; // Success!
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `[SW] Registration attempt ${attempt + 1}/${maxRetries} failed:`,
          error,
        );

        if (attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    console.error("[SW] Registration failed after all retries:", lastError);
    this.registrationPromise = null;
    throw lastError;
  }

  /**
   * Wait for browser to come online.
   */
  private waitForOnline(timeoutMs: number): Promise<void> {
    if (navigator.onLine) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        window.removeEventListener("online", onOnline);
        resolve(); // Continue anyway after timeout
      }, timeoutMs);

      const onOnline = () => {
        clearTimeout(timeout);
        window.removeEventListener("online", onOnline);
        resolve();
      };

      window.addEventListener("online", onOnline);
    });
  }

  /**
   * Wait for the service worker to become the controller.
   * Uses exponential backoff with a maximum wait time.
   */
  private async waitForController(maxWaitMs = 5000): Promise<boolean> {
    if (navigator.serviceWorker.controller) {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      let resolved = false;

      // Listen for controller change
      const onControllerChange = () => {
        if (!resolved) {
          resolved = true;
          console.log("[SW] Controller acquired");
          resolve(true);
        }
      };

      navigator.serviceWorker.addEventListener(
        "controllerchange",
        onControllerChange,
        { once: true },
      );

      // Also poll with exponential backoff as a fallback
      const startTime = Date.now();
      const poll = async () => {
        if (resolved) return;

        if (navigator.serviceWorker.controller) {
          resolved = true;
          console.log("[SW] Controller acquired (poll)");
          resolve(true);
          return;
        }

        if (Date.now() - startTime >= maxWaitMs) {
          resolved = true;
          console.warn(
            "[SW] Controller not acquired within timeout - will be ready on next page load",
          );
          resolve(false);
          return;
        }

        // Exponential backoff: 50, 100, 200, 400, 800...
        const elapsed = Date.now() - startTime;
        const delay = Math.min(
          50 * Math.pow(2, Math.floor(elapsed / 500)),
          800,
        );
        setTimeout(poll, delay);
      };

      poll();
    });
  }

  /**
   * Check if service worker is controlling the page.
   */
  isControlling(): boolean {
    return "serviceWorker" in navigator && !!navigator.serviceWorker.controller;
  }

  /**
   * Initialize and register service worker (legacy method for compatibility)
   * @param scriptURL - URL to the service worker script
   * @param options - Registration options (e.g., { type: 'module' } for ES module service workers)
   * @deprecated Use registerProactive() instead
   */
  async register(
    scriptURL: string,
    options?: RegistrationOptions,
  ): Promise<void> {
    return this.registerProactive(scriptURL, options);
  }

  /**
   * Send message to service worker with timeout.
   * Will wait for ongoing registration to complete before sending.
   */
  async send(
    message: ServiceWorkerMessage,
    timeoutMs = 30000,
  ): Promise<ServiceWorkerMessage> {
    // Wait for any ongoing registration to complete
    if (this.registrationPromise) {
      try {
        await this.registrationPromise;
      } catch (error) {
        throw new Error(
          `Service worker registration failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const controller = navigator.serviceWorker.controller;
    if (!controller) {
      throw new Error(
        "No service worker controller. Call registerProactive() first and await its completion.",
      );
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        messageChannel.port1.onmessage = null;
      };

      timeoutId = setTimeout(() => {
        cleanup();
        reject(
          new Error(`Service worker message timeout after ${timeoutMs}ms`),
        );
      }, timeoutMs);

      messageChannel.port1.onmessage = (event) => {
        cleanup();
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data);
        }
      };

      controller.postMessage(message, [messageChannel.port2]);
    });
  }

  /**
   * Listen for specific message types
   */
  on(type: string, callback: (data: ServiceWorkerMessage) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(type)?.delete(callback);
    };
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: ServiceWorkerMessage): void {
    const listeners = this.listeners.get(data.type);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  /**
   * Initialize Wayfinder in service worker
   */
  async initializeWayfinder(config: {
    trustedGateways: string[];
    routingGateways?: string[];
    routingStrategy: string;
    preferredGateway?: string;
    enabled: boolean;
    strict: boolean;
    concurrency?: number;
    verificationMethod?: "hash" | "signature";
  }): Promise<void> {
    await this.send({
      type: "INIT_WAYFINDER",
      config,
    });
  }

  /**
   * Clear all caches in service worker
   */
  async clearCache(): Promise<void> {
    await this.send({
      type: "CLEAR_CACHE",
    });
  }

  /**
   * Clear verification state and cached resources for a specific identifier.
   * Use this before retrying verification to ensure fresh verification.
   */
  async clearVerification(identifier: string): Promise<void> {
    await this.send({
      type: "CLEAR_VERIFICATION",
      identifier,
    });
  }

  /**
   * Check if a service worker update is available.
   */
  hasUpdate(): boolean {
    return this.updateAvailable;
  }

  /**
   * Register a callback to be notified when an update becomes available.
   * Returns an unsubscribe function.
   */
  onUpdateAvailable(callback: () => void): () => void {
    this.updateCallbacks.add(callback);
    // If update is already available, call immediately
    if (this.updateAvailable) {
      callback();
    }
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }

  private isApplyingUpdate = false;

  /**
   * Apply the pending update by activating the new service worker.
   * This will cause the page to reload with the new version.
   */
  applyUpdate(): void {
    // Guard against multiple calls
    if (this.isApplyingUpdate) {
      console.log("[SW] Update already in progress");
      return;
    }

    if (!this.registration?.waiting) {
      console.warn("[SW] No waiting worker to activate");
      return;
    }

    this.isApplyingUpdate = true;

    // Listen for controller change and reload (before posting message)
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        console.log("[SW] Controller changed, reloading...");
        window.location.reload();
      },
      { once: true },
    );

    // Tell the waiting worker to skip waiting
    this.registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }

  /**
   * Check for updates manually.
   */
  async checkForUpdate(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }
    try {
      await this.registration.update();
      return this.updateAvailable;
    } catch (err) {
      console.warn("[SW] Update check failed:", err);
      return false;
    }
  }
}

// Singleton instance
export const swMessenger = new ServiceWorkerMessenger();
