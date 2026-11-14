import {afterAll} from "vitest";
import {pool} from "../src/db.js";

if (!process.env.DB_NAME?.endsWith("_test")) {
  throw new Error(
    `Refusing to run tests: DB_NAME must end with "_test", but it is "${process.env.DB_NAME}"`,
  );
}

// Close the database connections when a test file finishes
afterAll(async () => {
  await pool.end();
});
