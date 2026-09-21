import express from "express";

import storyRoutes from "./storyRoutes.js";
import illustrateRoutes from "./illustrateRoutes.js";
import narrateRoutes from "./narrateRoutes.js";
import metaRoutes from "./metaRoutes.js";
import alexaRoutes from "./alexaRoutes.js";

const router = express.Router();

router.use("/generate-story", storyRoutes);
router.use("/illustrate", illustrateRoutes);
router.use("/narrate", narrateRoutes);
router.use("/alexa", alexaRoutes);
router.use("/api/alexa", alexaRoutes);
// Meta routes handles /themes, /voices, /health
router.use("/", metaRoutes);

export default router;
