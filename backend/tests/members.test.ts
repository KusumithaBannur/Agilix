import { beforeEach, describe, expect, it } from "vitest";
import { api, createSkill, createTeam, resetDatabase } from "./helpers.js";

beforeEach(resetDatabase);

describe("POST /api/teams/:teamId/members", () => {
  it("creates a member with their skills", async () => {
    // Given a team and two skills
    const team = await createTeam();
    const sql = await createSkill("SQL");
    const react = await createSkill("React");

    // When we add a member who has both skills
    const res = await api
      .post(`/api/teams/${team.id}/members`)
      .send({ name: "Priya", weeklyHours: 40, skillIds: [sql.id, react.id] });

    // Then the member comes back with the skills sorted by name
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      teamId: team.id,
      name: "Priya",
      weeklyHours: 40,
      skills: [react, sql],
    });
  });

  it("creates a member with no skills", async () => {
    const team = await createTeam();

    const res = await api
      .post(`/api/teams/${team.id}/members`)
      .send({ name: "Ravi", weeklyHours: 20 });

    expect(res.status).toBe(201);
    expect(res.body.skills).toEqual([]);
  });

  it("saves nothing if one skill id does not exist (the transaction rolls back)", async () => {
    // Given a team and one real skill
    const team = await createTeam();
    const sql = await createSkill("SQL");

    // When we add a member with the real skill and a skill id that does not exist
    const res = await api
      .post(`/api/teams/${team.id}/members`)
      .send({ name: "Priya", weeklyHours: 40, skillIds: [sql.id, 999999] });

    // Then the request fails...
    expect(res.status).toBe(400);
    // ...and the member was not half-saved
    const list = await api.get(`/api/teams/${team.id}/members`);
    expect(list.body).toEqual([]);
  });

  it("rejects more than 168 weekly hours", async () => {
    const team = await createTeam();

    const res = await api
      .post(`/api/teams/${team.id}/members`)
      .send({ name: "Priya", weeklyHours: 200 });

    expect(res.status).toBe(400);
    expect(res.body.details).toContainEqual(expect.objectContaining({ field: "weeklyHours" }));
  });

  it("returns 404 when the team does not exist", async () => {
    const res = await api
      .post("/api/teams/999999/members")
      .send({ name: "Priya", weeklyHours: 40 });

    expect(res.status).toBe(404);
  });

  it("returns 400 when the team id is not a number", async () => {
    const res = await api.post("/api/teams/abc/members").send({ name: "Priya", weeklyHours: 40 });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/teams/:teamId/members", () => {
  it("lists only the members of that team", async () => {
    // Given two teams with one member each
    const alpha = await createTeam("Alpha");
    const beta = await createTeam("Beta");
    await api.post(`/api/teams/${alpha.id}/members`).send({ name: "Priya", weeklyHours: 40 });
    await api.post(`/api/teams/${beta.id}/members`).send({ name: "Ravi", weeklyHours: 20 });

    // When we list Alpha's members
    const res = await api.get(`/api/teams/${alpha.id}/members`);

    // Then only Priya is there
    expect(res.status).toBe(200);
    expect(res.body.map((member: { name: string }) => member.name)).toEqual(["Priya"]);
  });
});