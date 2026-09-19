import express from "express";
import { narrate } from "../controllers/narrateController.js";

const router = express.Router();

router.post("/", narrate);

export default router;
