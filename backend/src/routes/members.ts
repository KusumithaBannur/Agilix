import { type Request, Router } from "express";
import { z } from "zod";
import { isDatabaseError, pool, teamExists } from "../db.js";
import { idSchema, sendValidationError } from "../validation.js";

export const membersRouter = Router({ mergeParams: true });

const createMemberSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  weeklyHours: z.number().min(0, "Cannot be negative").max(168, "A week has only 168 hours"),
  skillIds: z.array(idSchema).max(20, "Too many skills").default([]),
});

type TeamParams = {
  teamId: string;
};

type Skill = {
  id: number;
  name: string;
};

type MemberRow = {
  id: number;
  team_id: number;
  name: string;
  weekly_hours: string;
  skills: Skill[];
};

const MEMBER_QUERY = `
  SELECT
    m.id,
    m.team_id,
    m.name,
    m.weekly_hours,
    COALESCE(
      json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.name)
        FILTER (WHERE s.id IS NOT NULL),
      '[]'
    ) AS skills
  FROM members m
  LEFT JOIN member_skills ms ON ms.member_id = m.id
  LEFT JOIN skills s ON s.id = ms.skill_id
`;

function toMember(row: MemberRow) {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    weeklyHours: Number(row.weekly_hours),
    skills: row.skills,
  };
}


membersRouter.post("/", async (req: Request<TeamParams>, res) => {
  const teamId = idSchema.safeParse(req.params.teamId);
  if (!teamId.success) {
    res.status(400).json({ error: "Team id must be a positive whole number" });
    return;
  }

  const result = createMemberSchema.safeParse(req.body);
  if (!result.success) {
    sendValidationError(res, result.error);
    return;
  }

  if (!(await teamExists(teamId.data))) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const { name, weeklyHours } = result.data;
  const skillIds = [...new Set(result.data.skillIds)];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const inserted = await client.query<{ id: number }>(
      "INSERT INTO members (team_id, name, weekly_hours) VALUES ($1, $2, $3) RETURNING id",
      [teamId.data, name, weeklyHours],
    );
    const memberId = inserted.rows[0].id;

    if (skillIds.length > 0) {
      await client.query(
        "INSERT INTO member_skills (member_id, skill_id) SELECT $1, unnest($2::int[])",
        [memberId, skillIds],
      );
    }

    const { rows } = await client.query<MemberRow>(
      MEMBER_QUERY + " WHERE m.id = $1 GROUP BY m.id",
      [memberId],
    );

    await client.query("COMMIT");
    res.status(201).json(toMember(rows[0]));
  } catch (error) {
    await client.query("ROLLBACK");
    if (isDatabaseError(error, "23503") && error.constraint === "member_skills_skill_id_fkey") {
      res.status(400).json({ error: "One or more skill ids do not exist" });
      return;
    }
    throw error;
  } finally {
    client.release();
  }
});

membersRouter.get("/", async (req: Request<TeamParams>, res) => {
  const teamId = idSchema.safeParse(req.params.teamId);
  if (!teamId.success) {
    res.status(400).json({ error: "Team id must be a positive whole number" });
    return;
  }

  if (!(await teamExists(teamId.data))) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const { rows } = await pool.query<MemberRow>(
    MEMBER_QUERY + " WHERE m.team_id = $1 GROUP BY m.id ORDER BY m.id",
    [teamId.data],
  );
  res.json(rows.map(toMember));
});