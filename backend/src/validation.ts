import type {Response} from "express";
import {z} from "zod";

export const idSchema = z.coerce.number().int().positive();

export function sendValidationError(res: Response, error:z.ZodError){
    res.status(400).json({
        error: "Invalid input",
        details: error.issues.map((issue)=>({
            field : issue.path.join("."),
            message: issue.message,
        })),
    });
}