import { Hono } from "hono";

const players = new Hono();

/**
 * POST /api/players/join
 * Người chơi nhập SĐT + tên — không cần OTP/verify.
 * Nếu SĐT đã tồn tại, cập nhật fingerprint và trả về thông tin hiện tại.
 * Lưu fingerprint từ User-Agent + IP để nhận dạng lần sau.
 */
players.post("/players/join", async (c) => {
  const { default: sql } = await import("../db");

  let body: { phone?: string; name?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const phone = body.phone?.trim();
  const name = body.name?.trim() || null;

  if (!phone) {
    return c.json({ error: "Số điện thoại không được để trống" }, 400);
  }

  // Build a simple fingerprint from User-Agent + IP
  const ua = c.req.header("User-Agent") ?? "";
  const ip = c.req.header("X-Forwarded-For") ?? c.req.header("CF-Connecting-IP") ?? "";
  const fingerprint = `${ip}|${ua}`.slice(0, 512);

  // Upsert player record
  const [player] = await sql`
    INSERT INTO players (phone, name, fingerprint)
    VALUES (${phone}, ${name}, ${fingerprint})
    ON CONFLICT (phone) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, players.name),
      fingerprint = EXCLUDED.fingerprint
    RETURNING id, phone, name, created_at
  `;

  console.log(`  👤 Player join: "${player.name || player.phone}" (id=${player.id})`);
  return c.json({ id: player.id, phone: player.phone, name: player.name });
});

/**
 * GET /api/attendees

/**
 * GET /api/attendees
 * Returns all attendees with their excluded status.
 * Public — the client filters for the wheel display.
 */
players.get("/attendees", async (c) => {
  const { default: sql } = await import("../db");
  const rows = await sql`
    SELECT id, name, excluded, created_at
    FROM attendees
    ORDER BY created_at ASC
  `;
  return c.json(rows);
});

/**
 * POST /api/attendees/reset-excluded
 * Mở lại tất cả attendees vào pool quay.
 * Public — tin tưởng người dùng (mini game tập thể).
 */
players.post("/attendees/reset-excluded", async (c) => {
  const { default: sql } = await import("../db");
  const { broadcast } = await import("../ws");

  await sql`UPDATE attendees SET excluded = false`;

  const attendees = await sql`SELECT id, name, excluded, created_at FROM attendees ORDER BY created_at ASC`;
  broadcast("state_update", { attendees });

  return c.json({ ok: true });
});

export default players;
