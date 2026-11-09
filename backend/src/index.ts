import express from "express";
import { pool } from "./db.js";

const app = express();
const PORT = Number(process.env.PORT?? 3000);

app.use(express.json());

app.get("/api/health", async (_req, res) => {
    try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "ok" });
  } catch (error) {
    console.error("Database check failed:", error);
    res.status(503).json({ status: "error", database: "unreachable" });
  }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});