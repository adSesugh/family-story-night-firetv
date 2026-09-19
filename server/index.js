import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import apiRoutes from "./routes/index.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Mount all routes
app.use("/", apiRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Family Story Night server running on port ${PORT}`));

export { app };
