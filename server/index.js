import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import apiRoutes from "./routes/index.js";
import { getActiveIllustrationEngine } from "./services/imageService.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    const devId = req.headers["x-device-id"] || req.query.deviceId || "-";
    const uId = req.headers["x-user-id"] || req.query.userId || "-";
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms) [dev:${devId}] [user:${uId}]`);
  });
  next();
});

// Mount all routes
app.use("/", apiRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Family Story Night server running on port ${PORT}`);
  const engine = getActiveIllustrationEngine();
  if (engine === "stability") {
    console.log(`[Illustrations] Engine: ⚡ Stability AI Direct API (v2beta/stable-image/generate/core)`);
  } else if (engine === "kaggle") {
    const kaggleUrl = process.env.KAGGLE_NGROK_URL || process.env.ILLUSTRATION_API_URL;
    console.log(`[Illustrations] Engine: 🚀 Kaggle ngrok tunnel -> ${kaggleUrl}`);
  } else {
    console.log(`[Illustrations] Engine: ☁️ AWS Bedrock (${process.env.BEDROCK_IMAGE_MODEL_ID || "stability.stable-image-core-v1:1"})`);
  }
});

export { app };
