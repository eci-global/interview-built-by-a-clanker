import { buildApp } from "./app.js";

// Process entrypoint: build the app (see app.ts) and start listening.
// The build/configuration lives in buildApp() so the test suite can exercise
// the same app via inject() without binding a port.
const app = await buildApp({ logger: true });

try {
  await app.listen({ port: 3001, host: "0.0.0.0" });
  console.log("API server running on http://localhost:3001");
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
