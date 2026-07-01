import { Hono } from "hono";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { adminAuth } from "../middleware/auth";
import { queryWithTimeout } from "../db";

const admin = new Hono();

// ─── Helpers ────────────────────────────────────────────────────────────────

function getSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) throw new Error("JWT_SECRET not set");
  return new TextEncoder().encode(jwtSecret);
}

async function broadcastFullState() {
  try {
    const { default: sql } = await import("../db");
    const { broadcast } = await import("../ws");

    const [games, attendees] = await Promise.all([
      sql`SELECT id, title, duration, enabled, objective, supplies, notes, extra, sort_order FROM games ORDER BY sort_order`,
      sql`SELECT id, name, excluded, created_at FROM attendees ORDER BY created_at ASC`,
    ]);

    const mappedGames = games.map((g) => {
      // Guard: extra must be an object — spreading a string causes corruption
      const rawExtra = g.extra;
      const extra = (typeof rawExtra === 'object' && rawExtra !== null ? rawExtra : {}) as Record<string, unknown>;
      return {
        ...g,
        bingoItems: extra.bingoItems ?? undefined,
        bingoSize: extra.bingoSize ?? undefined,
        bingoFreeSpace: extra.bingoFreeSpace ?? undefined,
      };
    });

    broadcast("state_update", { games: mappedGames, attendees });
  } catch (err) {
    console.error("broadcastFullState failed:", err);
  }
}

// ─── Auth Routes (public) ────────────────────────────────────────────────────

/**
 * POST /api/admin/auth/login
 * username + password → JWT token (24h)
 */
admin.post("/auth/login", async (c) => {
  const { default: sql } = await import("../db");

  let body: { username?: string; password?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const { username, password } = body;
  if (!username || !password) {
    return c.json({ error: "Username và password không được để trống" }, 400);
  }

  const [adminUser] = await sql`
    SELECT id, username, password_hash FROM admin_users WHERE username = ${username}
  `;

  if (!adminUser) {
    console.log(`🔐 Login failed — unknown user "${username}"`);
    return c.json({ error: "Sai tên đăng nhập hoặc mật khẩu" }, 401);
  }

  const valid = await bcrypt.compare(password, adminUser.password_hash as string);
  if (!valid) {
    console.log(`🔐 Login failed — wrong password for "${username}"`);
    return c.json({ error: "Sai tên đăng nhập hoặc mật khẩu" }, 401);
  }

  const token = await new SignJWT({
    sub: adminUser.id as string,
    username: adminUser.username as string,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret());

  console.log(`🔐 Login OK — "${username}" got token`);
  return c.json({ token, username: adminUser.username });
});

/**
 * GET /api/admin/auth/me
 * Returns current admin info from JWT.
 */
admin.get("/auth/me", adminAuth, (c) => {
  return c.json({
    id: c.get("adminId"),
    username: c.get("adminUsername"),
  });
});

// ─── Games CRUD (admin protected) ────────────────────────────────────────────

/**
 * GET /api/admin/games
 * All games including disabled, sorted by sort_order.
 */
admin.get("/games", adminAuth, async (c) => {
  const { default: sql } = await import("../db");
  const rows = await sql`
    SELECT id, title, duration, enabled, objective, supplies, notes, extra, sort_order
    FROM games ORDER BY sort_order ASC
  `;
  const result = rows.map((g) => ({
    id: g.id,
    title: g.title,
    duration: g.duration,
    enabled: g.enabled,
    objective: g.objective,
    supplies: g.supplies,
    notes: g.notes,
    bingoItems: (g.extra as Record<string, unknown>)?.bingoItems ?? undefined,
    bingoSize: (g.extra as Record<string, unknown>)?.bingoSize ?? undefined,
    bingoFreeSpace: (g.extra as Record<string, unknown>)?.bingoFreeSpace ?? undefined,
    sort_order: g.sort_order,
  }));
  return c.json(result);
});

/**
 * PUT /api/admin/games/:id
 * Update game config. Accepts same shape as client state.
 */
admin.put("/games/:id", adminAuth, async (c) => {
  const { default: sql } = await import("../db");
  const gameId = c.req.param("id");

  let body: {
    title?: string;
    duration?: number;
    enabled?: boolean;
    objective?: string;
    supplies?: string;
    notes?: string;
    bingoItems?: string[];
    bingoSize?: { rows: number; cols: number } | null;
    bingoFreeSpace?: boolean | null;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  try {
    // Validate bingoItems — must be array of strings, not corrupted object
    if (body.bingoItems !== undefined) {
      if (!Array.isArray(body.bingoItems)) {
        return c.json({ error: "bingoItems phải là một mảng các chuỗi" }, 400);
      }
      for (const item of body.bingoItems) {
        if (typeof item !== "string") {
          return c.json({ error: "bingoItems chỉ được chứa chuỗi ký tự" }, 400);
        }
      }
      // Sanity check: reject absurdly large data (more than 5000 items or 500KB serialized)
      if (body.bingoItems.length > 5000) {
        return c.json({ error: "bingoItems quá nhiều ô (tối đa 5000)" }, 400);
      }
    }

    const existingRow = await queryWithTimeout(
      sql`SELECT extra FROM games WHERE id = ${gameId}`
    );
    if (!existingRow.length) return c.json({ error: "Game not found" }, 404);

    // Guard: extra must be an object — spreading a string causes corruption
    const rawExtra = existingRow[0].extra;
    const existingExtra = (typeof rawExtra === 'object' && rawExtra !== null ? rawExtra : {}) as Record<string, unknown>;
    let newExtra = { ...existingExtra };
    if (body.bingoItems !== undefined) {
      newExtra.bingoItems = body.bingoItems;
    }
    if (body.bingoSize !== undefined) {
      newExtra.bingoSize = body.bingoSize;
    }
    if (body.bingoFreeSpace !== undefined) {
      newExtra.bingoFreeSpace = body.bingoFreeSpace;
    }

    const extraJson = JSON.stringify(newExtra);
    // Reject serialized extra > 500KB to prevent DB bloat
    if (extraJson.length > 500 * 1024) {
      console.error(`PUT /games/:id rejected: extra too large (${(extraJson.length / 1024).toFixed(1)}KB)`);
      return c.json({ error: "Dữ liệu quá lớn, vui lòng giảm bớt nội dung" }, 413);
    }

    await queryWithTimeout(sql`
      UPDATE games SET
        title      = COALESCE(${body.title ?? null}, title),
        duration   = COALESCE(${body.duration ?? null}, duration),
        enabled    = COALESCE(${body.enabled ?? null}, enabled),
        objective  = COALESCE(${body.objective ?? null}, objective),
        supplies   = COALESCE(${body.supplies ?? null}, supplies),
        notes      = COALESCE(${body.notes ?? null}, notes),
        extra      = ${extraJson}::jsonb,
        updated_at = now()
      WHERE id = ${gameId}
    `);

    await broadcastFullState();
    return c.json({ ok: true });
  } catch (err) {
    console.error("PUT /games/:id failed:", err);
    return c.json({ error: "Lưu thất bại, vui lòng thử lại" }, 500);
  }
});

// ─── Attendees CRUD (admin protected) ────────────────────────────────────────

/**
 * GET /api/admin/attendees
 * All attendees including excluded ones.
 */
admin.get("/attendees", adminAuth, async (c) => {
  const { default: sql } = await import("../db");
  const rows = await sql`
    SELECT id, name, excluded, created_at FROM attendees ORDER BY created_at ASC
  `;
  return c.json(rows);
});

/**
 * POST /api/admin/attendees
 * Add a single attendee. Skips if name already exists (case-insensitive).
 */
admin.post("/attendees", adminAuth, async (c) => {
  const { default: sql } = await import("../db");

  let body: { name?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const name = body.name?.trim();
  if (!name) return c.json({ error: "Tên không được để trống" }, 400);

  const [existing] = await sql`
    SELECT id FROM attendees WHERE lower(name) = lower(${name})
  `;
  if (existing) return c.json({ error: "Tên đã tồn tại", existing }, 409);

  const [attendee] = await sql`
    INSERT INTO attendees (name) VALUES (${name}) RETURNING id, name, excluded, created_at
  `;

  await broadcastFullState();
  return c.json(attendee, 201);
});

/**
 * POST /api/admin/attendees/import
 * Bulk import — accepts array of names, skips duplicates.
 */
admin.post("/attendees/import", adminAuth, async (c) => {
  const { default: sql } = await import("../db");

  let body: { names?: string[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const names = (body.names ?? [])
    .map((n) => String(n).trim())
    .filter(Boolean);

  if (!names.length) return c.json({ added: 0, skipped: 0 });

  // Get existing names to dedup
  const existing = await sql`SELECT lower(name) AS lname FROM attendees`;
  const existingSet = new Set(existing.map((r) => r.lname as string));

  const toInsert = names.filter((n) => !existingSet.has(n.toLowerCase()));

  if (toInsert.length > 0) {
    await sql`
      INSERT INTO attendees (name)
      SELECT unnest(${toInsert}::text[])
    `;
  }

  await broadcastFullState();
  return c.json({ added: toInsert.length, skipped: names.length - toInsert.length });
});

/**
 * PUT /api/admin/attendees/:id/exclude
 * Toggle the excluded flag.
 */
admin.put("/attendees/:id/exclude", adminAuth, async (c) => {
  const { default: sql } = await import("../db");
  const attendeeId = c.req.param("id");

  const [updated] = await sql`
    UPDATE attendees
    SET excluded = NOT excluded
    WHERE id = ${attendeeId}
    RETURNING id, name, excluded
  `;

  if (!updated) return c.json({ error: "Attendee not found" }, 404);

  await broadcastFullState();
  return c.json(updated);
});

/**
 * DELETE /api/admin/attendees/:id
 * Remove a single attendee.
 */
admin.delete("/attendees/:id", adminAuth, async (c) => {
  const { default: sql } = await import("../db");
  const attendeeId = c.req.param("id");

  await sql`DELETE FROM attendees WHERE id = ${attendeeId}`;
  await broadcastFullState();
  return c.json({ ok: true });
});

/**
 * DELETE /api/admin/attendees
 * Remove all attendees.
 */
admin.delete("/attendees", adminAuth, async (c) => {
  const { default: sql } = await import("../db");
  await sql`DELETE FROM attendees`;
  await broadcastFullState();
  return c.json({ ok: true });
});

// ─── Turn History (admin) ─────────────────────────────────────────────────────

/**
 * GET /api/admin/turns
 * Full turn history with attendee names.
 */
admin.get("/turns", adminAuth, async (c) => {
  const { default: sql } = await import("../db");
  const rows = await sql`
    SELECT
      gt.id, gt.game_id, gt.turn_type, gt.result, gt.created_at,
      a.name AS attendee_name
    FROM game_turns gt
    LEFT JOIN attendees a ON a.id = gt.attendee_id
    ORDER BY gt.created_at DESC
    LIMIT 200
  `;
  return c.json(rows);
});

export default admin;
