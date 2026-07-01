// WebSocket hub — broadcast events to all connected clients.
// Clients are stored as plain objects with a send() method so this module
// stays independent of the Hono WebSocket adapter internals.

interface WsClient {
  send: (data: string) => void;
}

const clients = new Set<WsClient>();

export function addClient(ws: WsClient): void {
  clients.add(ws);
  console.log(`🔌 WS client connected  (${clients.size} total)`);
}

export function removeClient(ws: WsClient): void {
  clients.delete(ws);
  console.log(`🔌 WS client disconnected (${clients.size} remaining)`);
}

export function broadcast(event: string, data: unknown): void {
  const message = JSON.stringify({ event, data });
  const n = clients.size;
  if (n > 0) {
    console.log(`📡 WS broadcast "${event}" → ${n} client(s) (${message.length}B)`);
  }
  for (const ws of clients) {
    queueMicrotask(() => {
      try {
        ws.send(message);
      } catch {
        clients.delete(ws);
      }
    });
  }
}

export function clientCount(): number {
  return clients.size;
}
