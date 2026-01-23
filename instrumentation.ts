export async function register() {
  // Try to load Sentry configs - skip if Sentry is not installed
  try {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("./sentry.server.config");
    }

    if (process.env.NEXT_RUNTIME === "edge") {
      await import("./sentry.edge.config");
    }
  } catch {
    // Sentry not available - continue without it
    console.log("Sentry instrumentation skipped - module not available");
  }
}
