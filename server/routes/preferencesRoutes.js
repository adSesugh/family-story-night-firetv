import express from "express";
import {
  getPreferencesHandler,
  savePreferencesHandler,
} from "../controllers/preferencesController.js";

const router = express.Router();

router.get("/", getPreferencesHandler);
router.post("/", savePreferencesHandler);

export default router;
