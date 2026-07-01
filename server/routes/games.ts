import { Hono } from "hono";

const games = new Hono();

function parseExtra(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
  }
  return (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
}

/**
 * GET /api/games
 * Returns all enabled games sorted by sort_order.
 * Public endpoint — no authentication required.
 */
games.get("/", async (c) => {
  const { default: sql } = await import("../db");
  const rows = await sql`
    SELECT id, title, duration, enabled, objective, supplies, notes, extra, sort_order
    FROM games
    WHERE enabled = true
    ORDER BY sort_order ASC
  `;

  const result = rows.map((row) => {
    const extra = parseExtra(row.extra);
    return {
      id: row.id,
      title: row.title,
      duration: row.duration,
      enabled: row.enabled,
      objective: row.objective,
      supplies: row.supplies,
      notes: row.notes,
      bingoItems: extra.bingoItems ?? undefined,
      bingoSize: extra.bingoSize ?? undefined,
      bingoFreeSpace: extra.bingoFreeSpace ?? undefined,
      sort_order: row.sort_order,
    };
  });

  console.log(`  🎮 ${result.length} enabled games returned`);
  return c.json(result);
});

export default games;
