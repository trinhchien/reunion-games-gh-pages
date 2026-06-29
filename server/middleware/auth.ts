import type { Context, Next } from "hono";
import { jwtVerify } from "jose";

export async function adminAuth(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return c.json({ error: "Server misconfigured" }, 500);
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);
    c.set("adminId", payload.sub as string);
    c.set("adminUsername", payload.username as string);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}
