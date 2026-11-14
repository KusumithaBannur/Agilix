import { beforeEach, describe, expect, it } from "vitest";
import { api, createSkill, resetDatabase } from "./helpers.js";

beforeEach(resetDatabase);

describe("/api/skills", () => {
  it("creates a skill", async () => {
    const res = await api.post("/api/skills").send({ name: "React" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(Number), name: "React" });
  });

  it("rejects a duplicate skill name with 409", async () => {
    // Given React already exists
    await createSkill("React");

    // When we add it again
    const res = await api.post("/api/skills").send({ name: "React" });

    // Then it is refused
    expect(res.status).toBe(409);
  });

  it("lists skills in alphabetical order", async () => {
    // Given skills added out of order
    await createSkill("SQL");
    await createSkill("Docker");
    await createSkill("React");

    // When we list them
    const res = await api.get("/api/skills");

    // Then they come back sorted by name
    expect(res.status).toBe(200);
    expect(res.body.map((skill: { name: string }) => skill.name)).toEqual(["Docker", "React", "SQL"]);
  });
});