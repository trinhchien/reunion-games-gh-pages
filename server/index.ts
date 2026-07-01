import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { createBunWebSocket } from "hono/bun";
import adminRoutes from "./routes/admin";
import gamesRoutes from "./routes/games";
import playersRoutes from "./routes/players";
import turnsRoutes from "./routes/turns";
import { addClient, removeClient } from "./ws";

// ─── Load .env ───────────────────────────────────────────────────────────────
// Bun natively loads .env — no dotenv needed.

const PORT = Number(process.env.PORT) || 3000;

// ─── Hono App ────────────────────────────────────────────────────────────────
const app = new Hono();

// ─── Request log ──────────────────────────────────────────────────────────────
app.use("*", async (c, next) => {
  const start = performance.now();
  await next();
  const ms = (performance.now() - start).toFixed(0);
  const len = c.res.headers.get("content-length") ?? "-";
  const emoji =
    c.res.status >= 500 ? "❌" :
    c.res.status >= 400 ? "⚠️" :
    c.res.status >= 300 ? "↪️" :
    "✅";
  console.log(`${emoji} ${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms ${len}B`);
});

// ─── API Routes ──────────────────────────────────────────────────────────────
app.route("/api/admin", adminRoutes);
app.route("/api/games", gamesRoutes);
app.route("/api", playersRoutes);   // mounts /api/players/* and /api/attendees/*
app.route("/api/turns", turnsRoutes);

// Health check
app.get("/api/health", (c) =>
  c.json({ status: "ok", ts: new Date().toISOString() })
);

// ─── WebSocket ───────────────────────────────────────────────────────────────
const { upgradeWebSocket, websocket } = createBunWebSocket();

app.get(
  "/ws",
  upgradeWebSocket(() => ({
    onOpen(_event, ws) {
      addClient(ws);
      ws.send(JSON.stringify({ event: "connected", data: { clients: 1 } }));
    },
    onMessage(event, _ws) {
      // Ping / keepalive — no action needed
      try {
        const msg = JSON.parse(event.data.toString());
        if (msg.type === "ping") {
          // silently ignore
        }
      } catch {
        // ignore non-JSON messages
      }
    },
    onClose(_event, ws) {
      removeClient(ws);
    },
    onError(_event, ws) {
      removeClient(ws);
    },
  }))
);

// ─── Static Files — serve public/ directory ──────────────────────────────────
// Must be last so API routes take priority.
app.use("/*", serveStatic({ root: "./public" }));

// SPA fallback — serve index.html for unknown routes
app.get("*", serveStatic({ path: "./public/index.html" }));

// ─── Start ───────────────────────────────────────────────────────────────────
console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
  websocket,
};
