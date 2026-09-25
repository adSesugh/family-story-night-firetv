import express from "express";
import {
  getPreferencesHandler,
  savePreferencesHandler,
  getCustomVoicesHandler,
  saveCustomVoiceHandler,
  deleteCustomVoiceHandler,
} from "../controllers/preferencesController.js";

const router = express.Router();

router.get("/", getPreferencesHandler);
router.post("/", savePreferencesHandler);

router.get("/custom-voices", getCustomVoicesHandler);
router.post("/custom-voices", saveCustomVoiceHandler);
router.delete("/custom-voices/:id", deleteCustomVoiceHandler);

export default router;

