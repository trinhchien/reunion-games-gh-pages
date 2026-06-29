import { Hono } from "hono";

const games = new Hono();

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

  // Map extra JSONB fields into a flat game shape matching the original state format
  const result = rows.map((row) => ({
    id: row.id,
    title: row.title,
    duration: row.duration,
    enabled: row.enabled,
    objective: row.objective,
    supplies: row.supplies,
    notes: row.notes,
    bingoItems: (row.extra as Record<string, unknown>)?.bingoItems ?? undefined,
    sort_order: row.sort_order,
  }));

  return c.json(result);
});

export default games;
