// app.ts — public Hono application instance.
//
// The Hono app is built in `./bootstrap.ts` and is fully configured with all
// routes, middleware, CORS, rate limiting, Better Auth, and security headers.
// Import from `@oc/api-server/app` to mount in any web framework:
//
//   import { app } from "@oc/api-server/app";
//   const response = await app.fetch(request);

export { app } from "./bootstrap";
