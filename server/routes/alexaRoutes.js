import express from "express";
import {
  handleAlexaWebhook,
  postSession,
  getEvents,
} from "../controllers/alexaController.js";

const router = express.Router();

// Alexa Skills Kit HTTPS webhook endpoint
router.post("/", handleAlexaWebhook);

// Fire TV client session registration/heartbeat
router.post("/session", postSession);

// Fire TV client events polling
router.get("/events", getEvents);

export default router;
