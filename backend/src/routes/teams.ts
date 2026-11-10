import {Router} from "express";
import {z} from "zod";
import {pool} from "../db.js";

export const teamsRouter = Router();

const createTeamSchema = z.object({
    name: z.string().trim().min(1,"Name is required").max(100,"Name is too long"),
    hoursPerPoint: z.number().positive("Must be more than 0").max(999.99,"Must be 999.99 or less"),
});

const idSchema = z.coerce.number().int().positive();

type TeamRow = {
    id: number;
    name: string;
    hours_per_point: string;
};

function toTeam(row: TeamRow){
    return{
        id: row.id,
        name: row.name,
        hoursPerPoint: Number(row.hours_per_point), 
    };
}

teamsRouter.post("/",async (req,res)=>{
    const result = createTeamSchema.safeParse(req.body);
    if(!result.success){
        res.status(400).json({
            error: "Invalid input",
            details: result.error.issues.map((issues)=>({
                field: issues.path.join("."),
                message: issues.message,
            })),
        });
        return;
    }

    const {name,hoursPerPoint} = result.data;

    try{
        const {rows} = await pool.query<TeamRow>(
           "INSERT INTO teams (name,hours_per_point) VALUES ($1,$2) RETURNING id, name, hours_per_point", [name, hoursPerPoint], 
        );
        res.status(201).json(toTeam(rows[0]));
    }catch(error){
        if(error instanceof Error && "code" in error && error.code === "23505"){
            res.status(409).json({error: "A team with this name already exists"});
            return;
        }
        throw error;
    }
});

teamsRouter.get("/", async (_req, res) => {
  const { rows } = await pool.query<TeamRow>(
    "SELECT id, name, hours_per_point FROM teams ORDER BY id",
  );
  res.json(rows.map(toTeam));
});

teamsRouter.get("/:id", async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: "Team id must be a positive whole number" });
    return;
  }

  const { rows } = await pool.query<TeamRow>(
    "SELECT id, name, hours_per_point FROM teams WHERE id = $1",
    [id.data],
  );

  if (rows.length === 0) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  res.json(toTeam(rows[0]));
});