import pg from "pg";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const pool = new pg.Pool({
  host: requireEnv("DB_HOST"),
  port: Number(requireEnv("DB_PORT")),
  database: requireEnv("DB_NAME"),
  user: requireEnv("DB_USER"),
  password: requireEnv("DB_PASSWORD"),
});

pool.on("error", (error) => {
  console.error("Unexpected database error:", error.message);
});

export function isDatabaseError(error: unknown, code: string): error is pg.DatabaseError {
  return error instanceof pg.DatabaseError && error.code === code;
}

export async function teamExists(teamId: number): Promise<boolean> {
  const { rowCount } = await pool.query("SELECT 1 FROM teams WHERE id = $1", [teamId]);
  return rowCount === 1;
}