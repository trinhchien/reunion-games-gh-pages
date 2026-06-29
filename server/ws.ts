// WebSocket hub — broadcast events to all connected clients.
// Clients are stored as plain objects with a send() method so this module
// stays independent of the Hono WebSocket adapter internals.

interface WsClient {
  send: (data: string) => void;
}

const clients = new Set<WsClient>();

export function addClient(ws: WsClient): void {
  clients.add(ws);
}

export function removeClient(ws: WsClient): void {
  clients.delete(ws);
}

export function broadcast(event: string, data: unknown): void {
  const message = JSON.stringify({ event, data });
  for (const ws of clients) {
    try {
      ws.send(message);
    } catch {
      // Remove stale connections silently
      clients.delete(ws);
    }
  }
}

export function clientCount(): number {
  return clients.size;
}
