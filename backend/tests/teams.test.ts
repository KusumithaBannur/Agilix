import { beforeEach, describe, expect, it } from "vitest";
import { api, createTeam, resetDatabase } from "./helpers.js";

beforeEach(resetDatabase);

describe("POST /api/teams", () => {
  it("creates a team and returns hoursPerPoint as a number", async () => {
    // Given an empty database

    // When we create a team (with extra spaces around the name)
    const res = await api.post("/api/teams").send({ name: "  Alpha  ", hoursPerPoint: 2.5 });

    // Then it is saved with a trimmed name and a numeric hoursPerPoint
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(Number), name: "Alpha", hoursPerPoint: 2.5 });
  });

  it("rejects a missing name with 400 and says which field is wrong", async () => {
    // When we leave out the name
    const res = await api.post("/api/teams").send({ hoursPerPoint: 2 });

    // Then we get a validation error pointing at "name"
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid input");
    expect(res.body.details).toContainEqual(expect.objectContaining({ field: "name" }));
  });

  it("rejects hoursPerPoint of 0", async () => {
    const res = await api.post("/api/teams").send({ name: "Alpha", hoursPerPoint: 0 });

    expect(res.status).toBe(400);
    expect(res.body.details).toContainEqual(expect.objectContaining({ field: "hoursPerPoint" }));
  });

  it("rejects a duplicate team name with 409", async () => {
    // Given a team called Alpha already exists
    await createTeam("Alpha");

    // When we create another team with the same name
    const res = await api.post("/api/teams").send({ name: "Alpha", hoursPerPoint: 3 });

    // Then it is refused as a conflict
    expect(res.status).toBe(409);
  });

  it("rejects a body that is not valid JSON with 400", async () => {
    const res = await api
      .post("/api/teams")
      .set("Content-Type", "application/json")
      .send('{"name": "Alpha",');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Request body is not valid JSON" });
  });

  it("stores SQL in a name as plain text instead of running it", async () => {
    // Given a name that looks like an SQL attack
    const name = "x'); DROP TABLE teams; --";

    // When we create a team with it
    const res = await api.post("/api/teams").send({ name, hoursPerPoint: 1 });

    // Then it is saved as text, and the teams table still works
    expect(res.status).toBe(201);
    expect(res.body.name).toBe(name);
    const list = await api.get("/api/teams");
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
  });
});

describe("GET /api/teams/:id", () => {
  it("returns the team when it exists", async () => {
    const team = await createTeam("Alpha", 2);

    const res = await api.get(`/api/teams/${team.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(team);
  });

  it("returns 404 when the team does not exist", async () => {
    const res = await api.get("/api/teams/999999");

    expect(res.status).toBe(404);
  });

  it("returns 400 when the id is not a positive whole number", async () => {
    const res = await api.get("/api/teams/abc");

    expect(res.status).toBe(400);
  });
});