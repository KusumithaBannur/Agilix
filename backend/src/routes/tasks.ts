import { type Request, Router } from "express";
import { z } from "zod";
import { isDatabaseError, pool, teamExists } from "../db.js";
import { findPath, type Edge } from "../graph.js";
import { idSchema, sendValidationError } from "../validation.js";

export const tasksRouter = Router({ mergeParams: true });

const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().trim().max(5000, "Description is too long").optional(),
  priority: z.number().int().min(1, "Priority is 1 to 4").max(4, "Priority is 1 to 4"),
  deadline: z.iso.date("Use the format YYYY-MM-DD").optional(),
  storyPoints: z.number().int().positive("Must be more than 0").max(100, "Must be 100 or less").optional(),
  requiredSkillId: idSchema.optional(),
  dependsOn: z.array(idSchema).max(50, "Too many dependencies").default([]),
});

const addDependencySchema = z.object({
  dependsOnTaskId: idSchema,
});

type TeamParams = {
  teamId: string;
};

type TaskParams = TeamParams & {
  taskId: string;
};

type DependencyParams = TaskParams & {
  dependsOnTaskId: string;
};

type TaskRow = {
  id: number;
  team_id: number;
  title: string;
  description: string | null;
  priority: number;
  deadline: string | null;
  story_points: number | null;
  required_skill_id: number | null;
  depends_on: number[];
};

const TASK_QUERY = `
  SELECT
    t.id,
    t.team_id,
    t.title,
    t.description,
    t.priority,
    to_char(t.deadline, 'YYYY-MM-DD') AS deadline,
    t.story_points,
    t.required_skill_id,
    COALESCE(
      (SELECT array_agg(d.depends_on_task_id ORDER BY d.depends_on_task_id)
       FROM task_dependencies d
       WHERE d.task_id = t.id),
      '{}'
    ) AS depends_on
  FROM tasks t
`;

function toTask(row: TaskRow) {
  return {
    id: row.id,
    teamId: row.team_id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    deadline: row.deadline,
    storyPoints: row.story_points,
    requiredSkillId: row.required_skill_id,
    dependsOn: row.depends_on,
  };
}

function parseTeamId(req: Request<TeamParams>) {
  return idSchema.safeParse(req.params.teamId);
}

tasksRouter.post("/", async (req: Request<TeamParams>, res) => {
  const teamId = parseTeamId(req);
  if (!teamId.success) {
    res.status(400).json({ error: "Team id must be a positive whole number" });
    return;
  }

  const result = createTaskSchema.safeParse(req.body);
  if (!result.success) {
    sendValidationError(res, result.error);
    return;
  }

  if (!(await teamExists(teamId.data))) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const task = result.data;
  const dependsOn = [...new Set(task.dependsOn)];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (dependsOn.length > 0) {
      const found = await client.query(
        "SELECT id FROM tasks WHERE team_id = $1 AND id = ANY($2::int[])",
        [teamId.data, dependsOn],
      );
      if (found.rowCount !== dependsOn.length) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "dependsOn contains tasks that are not in this team" });
        return;
      }
    }

    const inserted = await client.query<{ id: number }>(
      `INSERT INTO tasks
         (team_id, title, description, priority, deadline, story_points, required_skill_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        teamId.data,
        task.title,
        task.description ?? null,
        task.priority,
        task.deadline ?? null,
        task.storyPoints ?? null,
        task.requiredSkillId ?? null,
      ],
    );
    const taskId = inserted.rows[0].id;

    if (dependsOn.length > 0) {
      await client.query(
        "INSERT INTO task_dependencies (task_id, depends_on_task_id) SELECT $1, unnest($2::int[])",
        [taskId, dependsOn],
      );
    }

    const { rows } = await client.query<TaskRow>(TASK_QUERY + " WHERE t.id = $1", [taskId]);

    await client.query("COMMIT");
    res.status(201).json(toTask(rows[0]));
  } catch (error) {
    await client.query("ROLLBACK");
    if (isDatabaseError(error, "23503") && error.constraint === "tasks_required_skill_id_fkey") {
      res.status(400).json({ error: "Required skill does not exist" });
      return;
    }
    throw error;
  } finally {
    client.release();
  }
});

tasksRouter.get("/", async (req: Request<TeamParams>, res) => {
  const teamId = parseTeamId(req);
  if (!teamId.success) {
    res.status(400).json({ error: "Team id must be a positive whole number" });
    return;
  }

  if (!(await teamExists(teamId.data))) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const { rows } = await pool.query<TaskRow>(
    TASK_QUERY + " WHERE t.team_id = $1 ORDER BY t.priority, t.id",
    [teamId.data],
  );
  res.json(rows.map(toTask));
});

tasksRouter.post("/:taskId/dependencies", async (req: Request<TaskParams>, res) => {
  const teamId = parseTeamId(req);
  const taskId = idSchema.safeParse(req.params.taskId);
  if (!teamId.success || !taskId.success) {
    res.status(400).json({ error: "Team id and task id must be positive whole numbers" });
    return;
  }

  const result = addDependencySchema.safeParse(req.body);
  if (!result.success) {
    sendValidationError(res, result.error);
    return;
  }
  const dependsOnTaskId = result.data.dependsOnTaskId;

  if (dependsOnTaskId === taskId.data) {
    res.status(400).json({ error: "A task cannot depend on itself" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock the team row so two requests cannot add dependencies to this team at the same time.
    const team = await client.query("SELECT id FROM teams WHERE id = $1 FOR UPDATE", [teamId.data]);
    if (team.rowCount === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Team not found" });
      return;
    }

    const found = await client.query<{ id: number }>(
      "SELECT id FROM tasks WHERE team_id = $1 AND id = ANY($2::int[])",
      [teamId.data, [taskId.data, dependsOnTaskId]],
    );
    const foundIds = found.rows.map((row) => row.id);
    if (!foundIds.includes(taskId.data)) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Task not found" });
      return;
    }
    if (!foundIds.includes(dependsOnTaskId)) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "dependsOnTaskId is not a task in this team" });
      return;
    }

    const { rows: edges } = await client.query<Edge>(
      `SELECT d.task_id AS "from", d.depends_on_task_id AS "to"
       FROM task_dependencies d
       JOIN tasks t ON t.id = d.task_id
       WHERE t.team_id = $1`,
      [teamId.data],
    );

    // Adding "task depends on X" makes a loop if X already depends (directly or indirectly) on task.
    const path = findPath(edges, dependsOnTaskId, taskId.data);
    if (path) {
      await client.query("ROLLBACK");
      res.status(409).json({
        error: "This would create a dependency loop",
        loop: [taskId.data, ...path],
      });
      return;
    }

    const inserted = await client.query(
      `INSERT INTO task_dependencies (task_id, depends_on_task_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [taskId.data, dependsOnTaskId],
    );

    await client.query("COMMIT");
    res.status(inserted.rowCount === 1 ? 201 : 200).json({
      taskId: taskId.data,
      dependsOnTaskId,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

tasksRouter.delete(
  "/:taskId/dependencies/:dependsOnTaskId",
  async (req: Request<DependencyParams>, res) => {
    const teamId = parseTeamId(req);
    const taskId = idSchema.safeParse(req.params.taskId);
    const dependsOnTaskId = idSchema.safeParse(req.params.dependsOnTaskId);
    if (!teamId.success || !taskId.success || !dependsOnTaskId.success) {
      res.status(400).json({ error: "Ids must be positive whole numbers" });
      return;
    }

    const deleted = await pool.query(
      `DELETE FROM task_dependencies d
       USING tasks t
       WHERE t.id = d.task_id
         AND t.team_id = $1
         AND d.task_id = $2
         AND d.depends_on_task_id = $3`,
      [teamId.data, taskId.data, dependsOnTaskId.data],
    );

    if (deleted.rowCount === 0) {
      res.status(404).json({ error: "Dependency not found" });
      return;
    }

    res.status(204).end();
  },
);