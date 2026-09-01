/**
 * Startup hook. The actual work lives in a Node-only module that is imported
 * lazily, so the Edge bundle never has to resolve Node built-ins.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.OSSZ_SKIP_BOOTSTRAP === "1") return;
  const { bootstrap } = await import("@/lib/bootstrap");

  // Complete setup before requests are served. `bootstrap` handles connection
  // and schema errors internally, so a database outage still cannot crash the
  // server while an empty connected database is ready for the first request.
  await bootstrap();
}
