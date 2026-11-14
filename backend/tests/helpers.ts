import request from "supertest";
import { app } from "../src/app.js";
import { pool } from "../src/db.js";

export const api = request(app);


export async function resetDatabase() {
  await pool.query("DELETE FROM teams");
  await pool.query("DELETE FROM skills");
}

export async function createTeam(name = "Alpha", hoursPerPoint = 2) {
  const res = await api.post("/api/teams").send({ name, hoursPerPoint }).expect(201);
  return res.body as { id: number; name: string; hoursPerPoint: number };
}

export async function createSkill(name: string) {
  const res = await api.post("/api/skills").send({ name }).expect(201);
  return res.body as { id: number; name: string };
}

export async function createTask(teamId: number, title: string, extra: object = {}) {
  const res = await api
    .post(`/api/teams/${teamId}/tasks`)
    .send({ title, priority: 2, ...extra })
    .expect(201);
  return res.body as { id: number; dependsOn: number[] };
}