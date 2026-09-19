import express from "express";
import { generateStory } from "../controllers/storyController.js";

const router = express.Router();

router.post("/", generateStory);

export default router;
