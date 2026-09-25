import express from "express";

import storyRoutes from "./storyRoutes.js";
import illustrateRoutes from "./illustrateRoutes.js";
import narrateRoutes from "./narrateRoutes.js";
import metaRoutes from "./metaRoutes.js";
import alexaRoutes from "./alexaRoutes.js";
import historyRoutes from "./historyRoutes.js";
import preferencesRoutes from "./preferencesRoutes.js";

const router = express.Router();

router.use("/generate-story", storyRoutes);
router.use("/illustrate", illustrateRoutes);
router.use("/narrate", narrateRoutes);
router.use("/alexa", alexaRoutes);
router.use("/api/alexa", alexaRoutes);
router.use("/history", historyRoutes);
router.use("/api/history", historyRoutes);
router.use("/preferences", preferencesRoutes);
router.use("/api/preferences", preferencesRoutes);
// Meta routes handles /themes, /voices, /health, /voices/custom
router.use("/", metaRoutes);
router.use("/api", metaRoutes);

export default router;
