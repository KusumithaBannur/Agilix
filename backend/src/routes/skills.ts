import { Router } from "express";
import { z } from "zod";
import { isDatabaseError, pool } from "../db.js";
import { sendValidationError } from "../validation.js";

export const skillsRouter = Router();

const createSkillSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50, "Name is too long"),
});

type SkillRow = {
  id: number;
  name: string;
};

skillsRouter.post("/", async (req, res) => {
  const result = createSkillSchema.safeParse(req.body);
  if (!result.success) {
    sendValidationError(res, result.error);
    return;
  }

  try {
    const { rows } = await pool.query<SkillRow>(
      "INSERT INTO skills (name) VALUES ($1) RETURNING id, name",
      [result.data.name],
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    if (isDatabaseError(error, "23505")) {
      res.status(409).json({ error: "A skill with this name already exists" });
      return;
    }
    throw error;
  }
});

skillsRouter.get("/", async (_req, res) => {
  const { rows } = await pool.query<SkillRow>("SELECT id, name FROM skills ORDER BY name");
  res.json(rows);
});