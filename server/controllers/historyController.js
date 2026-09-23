import {
  getStories,
  getStoryById,
  saveStory,
  deleteStory,
  toggleFavorite,
} from "../db.js";

function extractDeviceId(req) {
  return (
    req.query?.deviceId ||
    req.headers?.["x-device-id"] ||
    req.body?.deviceId ||
    null
  );
}

/**
 * GET /api/history
 * Query: ?deviceId=...&limit=...
 */
export function getHistoryHandler(req, res) {
  try {
    const deviceId = extractDeviceId(req);
    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const stories = getStories(deviceId, limit);
    return res.json({ stories });
  } catch (err) {
    console.error("[historyController] getHistory error:", err);
    return res.status(500).json({ error: "Failed to fetch stories" });
  }
}

/**
 * GET /api/history/:id
 */
export function getStoryByIdHandler(req, res) {
  try {
    const deviceId = extractDeviceId(req);
    const { id } = req.params;
    if (!deviceId || !id) {
      return res.status(400).json({ error: "deviceId and id are required" });
    }

    const story = getStoryById(id, deviceId);
    if (!story) {
      return res.status(404).json({ error: "Story not found" });
    }

    return res.json({ story });
  } catch (err) {
    console.error("[historyController] getStoryById error:", err);
    return res.status(500).json({ error: "Failed to fetch story" });
  }
}

/**
 * POST /api/history
 * Body: { deviceId, story }
 */
export function saveStoryHandler(req, res) {
  try {
    const deviceId = extractDeviceId(req);
    const story = req.body?.story || req.body;

    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }
    if (!story || !story.id) {
      return res.status(400).json({ error: "Valid story object with an id is required" });
    }

    const saved = saveStory(deviceId, story);
    return res.json({ success: true, story: saved });
  } catch (err) {
    console.error("[historyController] saveStory error:", err);
    return res.status(500).json({ error: "Failed to save story" });
  }
}

/**
 * DELETE /api/history/:id
 */
export function deleteStoryHandler(req, res) {
  try {
    const deviceId = extractDeviceId(req);
    const { id } = req.params;

    if (!deviceId || !id) {
      return res.status(400).json({ error: "deviceId and id are required" });
    }

    const success = deleteStory(id, deviceId);
    return res.json({ success });
  } catch (err) {
    console.error("[historyController] deleteStory error:", err);
    return res.status(500).json({ error: "Failed to delete story" });
  }
}

/**
 * POST /api/history/:id/favorite
 */
export function toggleFavoriteHandler(req, res) {
  try {
    const deviceId = extractDeviceId(req);
    const { id } = req.params;

    if (!deviceId || !id) {
      return res.status(400).json({ error: "deviceId and id are required" });
    }

    const updated = toggleFavorite(id, deviceId);
    if (!updated) {
      return res.status(404).json({ error: "Story not found" });
    }

    return res.json({ success: true, story: updated, isFavorite: updated.isFavorite });
  } catch (err) {
    console.error("[historyController] toggleFavorite error:", err);
    return res.status(500).json({ error: "Failed to toggle favorite" });
  }
}
