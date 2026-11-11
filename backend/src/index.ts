import express, {type NextFunction, type Request, type Response} from "express";
import { pool } from "./db.js";
import { membersRouter } from "./routes/members.js";
import { teamsRouter } from "./routes/teams.js";
import { skillsRouter } from "./routes/skills.js";

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

app.use("/api/teams", teamsRouter);
app.use("/api/teams/:teamId/members", membersRouter);
app.use("/api/skills", skillsRouter);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if(error instanceof SyntaxError && "body" in error){
        res.status(400).json({error: "Request body is not valid JSON"});
        return;
    }
    console.error("Unexpected error:",error);
    res.status(500).json({error:"Something went wrong"});

});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});