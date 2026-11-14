import { beforeEach, describe, expect, it } from "vitest";
import { api, createSkill, createTask, createTeam, resetDatabase } from "./helpers.js";

beforeEach(resetDatabase);

describe("POST /api/teams/:teamId/tasks", () => {
  it("creates a task and keeps the deadline date exactly as sent", async () => {
    // Given a team and a skill
    const team = await createTeam();
    const sql = await createSkill("SQL");

    // When we create a task with a deadline
    const res = await api.post(`/api/teams/${team.id}/tasks`).send({
      title: "Design database",
      priority: 1,
      deadline: "2026-11-20",
      storyPoints: 5,
      requiredSkillId: sql.id,
    });

    // Then the deadline is the same day (not shifted by the time zone)
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      teamId: team.id,
      title: "Design database",
      description: null,
      priority: 1,
      deadline: "2026-11-20",
      storyPoints: 5,
      requiredSkillId: sql.id,
      dependsOn: [],
    });
  });

  it("creates a task with dependencies on tasks in the same team", async () => {
    const team = await createTeam();
    const design = await createTask(team.id, "Design database");

    const res = await api
      .post(`/api/teams/${team.id}/tasks`)
      .send({ title: "Build API", priority: 2, dependsOn: [design.id] });

    expect(res.status).toBe(201);
    expect(res.body.dependsOn).toEqual([design.id]);
  });

  it("rejects a dependency on a task from another team", async () => {
    // Given a task that belongs to team Beta
    const alpha = await createTeam("Alpha");
    const beta = await createTeam("Beta");
    const betaTask = await createTask(beta.id, "Beta work");

    // When an Alpha task tries to depend on it
    const res = await api
      .post(`/api/teams/${alpha.id}/tasks`)
      .send({ title: "Alpha work", priority: 2, dependsOn: [betaTask.id] });

    // Then it is refused, and no Alpha task was saved
    expect(res.status).toBe(400);
    const list = await api.get(`/api/teams/${alpha.id}/tasks`);
    expect(list.body).toEqual([]);
  });

  it("rejects a required skill that does not exist", async () => {
    const team = await createTeam();

    const res = await api
      .post(`/api/teams/${team.id}/tasks`)
      .send({ title: "Build screens", priority: 2, requiredSkillId: 999999 });

    expect(res.status).toBe(400);
  });

  it("rejects a deadline in the wrong format", async () => {
    const team = await createTeam();

    const res = await api
      .post(`/api/teams/${team.id}/tasks`)
      .send({ title: "Build API", priority: 2, deadline: "20-11-2026" });

    expect(res.status).toBe(400);
    expect(res.body.details).toContainEqual(expect.objectContaining({ field: "deadline" }));
  });

  it("rejects a priority outside 1 to 4", async () => {
    const team = await createTeam();

    const res = await api.post(`/api/teams/${team.id}/tasks`).send({ title: "Build API", priority: 5 });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/teams/:teamId/tasks", () => {
  it("lists tasks by priority, then by id", async () => {
    const team = await createTeam();
    await createTask(team.id, "Low", { priority: 4 });
    await createTask(team.id, "Urgent", { priority: 1 });
    await createTask(team.id, "Normal A", { priority: 2 });
    await createTask(team.id, "Normal B", { priority: 2 });

    const res = await api.get(`/api/teams/${team.id}/tasks`);

    expect(res.status).toBe(200);
    expect(res.body.map((task: { title: string }) => task.title)).toEqual([
      "Urgent",
      "Normal A",
      "Normal B",
      "Low",
    ]);
  });

  it("returns 404 when the team does not exist", async () => {
    const res = await api.get("/api/teams/999999/tasks");

    expect(res.status).toBe(404);
  });
});

describe("POST /api/teams/:teamId/tasks/:taskId/dependencies", () => {
  it("adds a dependency with 201, and answers 200 if it already exists", async () => {
    // Given two tasks with no dependencies
    const team = await createTeam();
    const a = await createTask(team.id, "A");
    const b = await createTask(team.id, "B");
    const url = `/api/teams/${team.id}/tasks/${a.id}/dependencies`;

    // When we say A depends on B, twice
    const first = await api.post(url).send({ dependsOnTaskId: b.id });
    const second = await api.post(url).send({ dependsOnTaskId: b.id });

    // Then the first one creates it and the second one changes nothing
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    const list = await api.get(`/api/teams/${team.id}/tasks`);
    const savedA = list.body.find((task: { id: number }) => task.id === a.id);
    expect(savedA.dependsOn).toEqual([b.id]);
  });

  it("refuses a task depending on itself", async () => {
    const team = await createTeam();
    const a = await createTask(team.id, "A");

    const res = await api
      .post(`/api/teams/${team.id}/tasks/${a.id}/dependencies`)
      .send({ dependsOnTaskId: a.id });

    expect(res.status).toBe(400);
  });

  it("refuses a dependency loop with 409 and shows the loop", async () => {
    // Given A depends on C, and C depends on B
    const team = await createTeam();
    const a = await createTask(team.id, "A");
    const b = await createTask(team.id, "B");
    const c = await createTask(team.id, "C", { dependsOn: [b.id] });
    await api
      .post(`/api/teams/${team.id}/tasks/${a.id}/dependencies`)
      .send({ dependsOnTaskId: c.id })
      .expect(201);

    // When we try to make B depend on A
    const res = await api
      .post(`/api/teams/${team.id}/tasks/${b.id}/dependencies`)
      .send({ dependsOnTaskId: a.id });

    // Then it is refused, the response shows the whole loop, and nothing was saved
    expect(res.status).toBe(409);
    expect(res.body.loop).toEqual([b.id, a.id, c.id, b.id]);
    const list = await api.get(`/api/teams/${team.id}/tasks`);
    const savedB = list.body.find((task: { id: number }) => task.id === b.id);
    expect(savedB.dependsOn).toEqual([]);
  });

  it("refuses a dependency on a task from another team", async () => {
    const alpha = await createTeam("Alpha");
    const beta = await createTeam("Beta");
    const alphaTask = await createTask(alpha.id, "Alpha work");
    const betaTask = await createTask(beta.id, "Beta work");

    const res = await api
      .post(`/api/teams/${alpha.id}/tasks/${alphaTask.id}/dependencies`)
      .send({ dependsOnTaskId: betaTask.id });

    expect(res.status).toBe(400);
  });

  it("returns 404 when the task is not in this team", async () => {
    const alpha = await createTeam("Alpha");
    const beta = await createTeam("Beta");
    const alphaTask = await createTask(alpha.id, "Alpha work");
    const betaTask = await createTask(beta.id, "Beta work");

    // Using Alpha's URL with Beta's task id
    const res = await api
      .post(`/api/teams/${alpha.id}/tasks/${betaTask.id}/dependencies`)
      .send({ dependsOnTaskId: alphaTask.id });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/teams/:teamId/tasks/:taskId/dependencies/:dependsOnTaskId", () => {
  it("removes a dependency with 204, then answers 404 the second time", async () => {
    // Given A depends on B
    const team = await createTeam();
    const b = await createTask(team.id, "B");
    const a = await createTask(team.id, "A", { dependsOn: [b.id] });
    const url = `/api/teams/${team.id}/tasks/${a.id}/dependencies/${b.id}`;

    // When we delete it twice
    const first = await api.delete(url);
    const second = await api.delete(url);

    // Then the first works and the second finds nothing to delete
    expect(first.status).toBe(204);
    expect(second.status).toBe(404);
  });
});