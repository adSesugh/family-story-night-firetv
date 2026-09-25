import express from "express";
import { getThemes, getVoices, getHealth } from "../controllers/metaController.js";
import {
  getCustomVoicesHandler,
  saveCustomVoiceHandler,
  deleteCustomVoiceHandler,
} from "../controllers/preferencesController.js";

const router = express.Router();

router.get("/themes", getThemes);
router.get("/voices", getVoices);
router.get("/health", getHealth);

router.get("/voices/custom", getCustomVoicesHandler);
router.post("/voices/custom", saveCustomVoiceHandler);
router.delete("/voices/custom/:id", deleteCustomVoiceHandler);

export default router;
