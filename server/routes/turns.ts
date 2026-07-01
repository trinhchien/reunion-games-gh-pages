import { Hono } from "hono";

const turns = new Hono();

/**
 * POST /api/turns/spin
 * Server picks random winner from non-excluded attendees, saves to game_turns,
 * broadcasts result via WebSocket, and returns winner + pool so client
 * can animate to the correct wheel position.
 *
 * Body: { autoExclude?: boolean }  — default true
 */
turns.post("/spin", async (c) => {
  const { default: sql } = await import("../db");
  const { broadcast } = await import("../ws");

  let autoExclude = true;
  try {
    const body = await c.req.json<{ autoExclude?: boolean }>();
    if (typeof body.autoExclude === "boolean") {
      autoExclude = body.autoExclude;
    }
  } catch {
    // Body is optional — use defaults
  }

  // Get eligible attendees in stable order for consistent index mapping with client
  const eligible = await sql<{ id: string; name: string }[]>`
    SELECT id, name FROM attendees
    WHERE excluded = false
    ORDER BY created_at ASC
  `;

  if (eligible.length === 0) {
    console.log("  🎡 Spin failed — empty pool");
    return c.json({ error: "Không có người hợp lệ trong pool quay" }, 400);
  }

  console.log(`  🎡 Spinning from ${eligible.length} eligible`);

  // Pick random winner
  const winnerIndex = Math.floor(Math.random() * eligible.length);
  const winner = eligible[winnerIndex];

  // Optionally mark winner as excluded
  if (autoExclude) {
    await sql`UPDATE attendees SET excluded = true WHERE id = ${winner.id}`;
  }

  // Save to game_turns
  const [turn] = await sql`
    INSERT INTO game_turns (game_id, turn_type, attendee_id, result)
    VALUES (
      'wheel',
      'wheel_spin',
      ${winner.id},
      ${JSON.stringify({ winner_name: winner.name, auto_excluded: autoExclude })}::jsonb
    )
    RETURNING id
  `;

  // Broadcast winner to all connected screens
  broadcast("wheel_result", {
    winner: { id: winner.id, name: winner.name },
    winnerIndex,
    total: eligible.length,
    turn_id: turn.id,
  });

  // Also broadcast updated attendees state
  const allAttendees = await sql`
    SELECT id, name, excluded, created_at FROM attendees ORDER BY created_at ASC
  `;
  broadcast("state_update", { attendees: allAttendees });

  return c.json({
    winner: { id: winner.id, name: winner.name },
    winnerIndex,
    eligible,       // client uses this pool for animation (same order as server chose from)
    turn_id: turn.id,
  });
});

/**
 * GET /api/turns/history
 * Recent 50 turn records — public view.
 */
turns.get("/history", async (c) => {
  const { default: sql } = await import("../db");
  const rows = await sql`
    SELECT
      gt.id, gt.game_id, gt.turn_type, gt.result, gt.created_at,
      a.name AS attendee_name
    FROM game_turns gt
    LEFT JOIN attendees a ON a.id = gt.attendee_id
    ORDER BY gt.created_at DESC
    LIMIT 50
  `;
  return c.json(rows);
});

export default turns;
