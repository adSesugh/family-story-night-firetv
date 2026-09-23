import express from "express";
import {
  getHistoryHandler,
  getStoryByIdHandler,
  saveStoryHandler,
  deleteStoryHandler,
  toggleFavoriteHandler,
} from "../controllers/historyController.js";

const router = express.Router();

router.get("/", getHistoryHandler);
router.post("/", saveStoryHandler);
router.get("/:id", getStoryByIdHandler);
router.delete("/:id", deleteStoryHandler);
router.post("/:id/favorite", toggleFavoriteHandler);

export default router;
