/**
 * Custom Node.js server for MIAS-IO.
 *
 * Wraps the Next.js request handler and adds WebSocket upgrade support
 * on /ws for the DevTools live monitoring feature. All HTTP requests
 * are passed through to Next.js unchanged.
 *
 * Usage:
 *   Production: node --import tsx server.ts
 *   Dev: next dev (WS not available in dev — use mock or test in prod mode)
 */

import { createServer } from "http";
import next from "next";
import { parse } from "url";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const hostname = process.env.HOSTNAME || "0.0.0.0";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Only set up WebSocket in production (dev mode uses next dev)
  if (!dev) {
    // Dynamic import to avoid loading OPC UA in dev mode
    const { setupWebSocketServer } = await import("./src/server/lib/ws/server");
    setupWebSocketServer(server);
  }

  server.listen(port, hostname, () => {
    console.log(`> MIAS-IO ready on http://${hostname}:${port}`);
    if (!dev) {
      console.log("> WebSocket server available on /ws");
    }
  });
});
