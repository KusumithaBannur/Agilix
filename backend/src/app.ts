import express, { type NextFunction, type Request, type Response } from "express";
import { pool } from "./db.js";
import { membersRouter } from "./routes/members.js";
import { skillsRouter } from "./routes/skills.js";
import { tasksRouter } from "./routes/tasks.js";
import { teamsRouter } from "./routes/teams.js";

export const app = express();

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

app.use("/api/teams", teamsRouter);
app.use("/api/teams/:teamId/members", membersRouter);
app.use("/api/teams/:teamId/tasks", tasksRouter);
app.use("/api/skills", skillsRouter);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ error: "Request body is not valid JSON" });
    return;
  }
  console.error("Unexpected error:", error);
  res.status(500).json({ error: "Something went wrong" });
});