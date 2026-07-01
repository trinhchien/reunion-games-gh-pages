import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const sql = postgres(DATABASE_URL, {
  max: 20,
  idle_timeout: 5,
  connect_timeout: 10,
  connection: {
    statement_timeout: "8000",
  },
});

// Timeout wrapper — returns error if query takes too long
export async function queryWithTimeout<T>(
  query: Promise<T>,
  ms = 10000
): Promise<T> {
  const start = performance.now();
  try {
    const result = await Promise.race([
      query,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Query timeout after ${ms}ms`)), ms)
      ),
    ]);
    const elapsed = (performance.now() - start).toFixed(0);
    console.log(`  🗄️  DB query OK (${elapsed}ms)`);
    return result;
  } catch (err) {
    const elapsed = (performance.now() - start).toFixed(0);
    console.error(`  🗄️  DB query FAIL (${elapsed}ms): ${err}`);
    throw err;
  }
}

export default sql;
