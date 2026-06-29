/**
 * seed-admin.ts
 * Tạo tài khoản admin đầu tiên.
 * Chạy: bun run seed
 *
 * Ví dụ: ADMIN_USERNAME=admin ADMIN_PASSWORD=mypassword bun run seed
 * Hoặc nhập trực tiếp khi script chạy.
 */
import bcrypt from "bcryptjs";
import sql from "./db";

const username = process.env.ADMIN_USERNAME ?? (await prompt("Tên đăng nhập admin: "));
const password = process.env.ADMIN_PASSWORD ?? (await prompt("Mật khẩu (ít nhất 8 ký tự): "));

if (!username || username.length < 2) {
  console.error("❌ Tên đăng nhập quá ngắn (tối thiểu 2 ký tự).");
  process.exit(1);
}

if (!password || password.length < 8) {
  console.error("❌ Mật khẩu quá ngắn (tối thiểu 8 ký tự).");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);

try {
  const [admin] = await sql`
    INSERT INTO admin_users (username, password_hash)
    VALUES (${username}, ${hash})
    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
    RETURNING id, username, created_at
  `;
  console.log(`✅ Admin "${admin.username}" đã được tạo (ID: ${admin.id})`);
} catch (err) {
  console.error("❌ Lỗi khi tạo admin:", err);
} finally {
  await sql.end();
}

async function prompt(question: string): Promise<string> {
  process.stdout.write(question);
  const buf = Buffer.alloc(256);
  const n = await new Promise<number>((resolve, reject) => {
    process.stdin.once("data", (chunk) => {
      chunk.copy(buf);
      resolve(chunk.length);
    });
    process.stdin.once("error", reject);
  });
  return buf.subarray(0, n).toString().trim();
}
