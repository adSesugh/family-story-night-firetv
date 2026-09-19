import express from "express";
import { getThemes, getVoices, getHealth } from "../controllers/metaController.js";

const router = express.Router();

router.get("/themes", getThemes);
router.get("/voices", getVoices);
router.get("/health", getHealth);

export default router;
