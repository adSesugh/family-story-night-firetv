import express from "express";
import { illustrate } from "../controllers/illustrateController.js";

const router = express.Router();

router.post("/", illustrate);

export default router;
