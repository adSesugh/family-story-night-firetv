import { getPreferences, savePreferences } from "../db.js";

function extractDeviceId(req) {
  return (
    req.query?.deviceId ||
    req.headers?.["x-device-id"] ||
    req.body?.deviceId ||
    null
  );
}

/**
 * GET /api/preferences
 * Query: ?deviceId=...
 */
export function getPreferencesHandler(req, res) {
  try {
    const deviceId = extractDeviceId(req);
    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }

    const preferences = getPreferences(deviceId);
    return res.json({ preferences: preferences || null });
  } catch (err) {
    console.error("[preferencesController] getPreferences error:", err);
    return res.status(500).json({ error: "Failed to fetch preferences" });
  }
}

/**
 * POST /api/preferences
 * Body: { deviceId, preferences }
 */
export function savePreferencesHandler(req, res) {
  try {
    const deviceId = extractDeviceId(req);
    const prefs = req.body?.preferences || req.body;

    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }

    const updated = savePreferences(deviceId, prefs);
    return res.json({ success: true, preferences: updated });
  } catch (err) {
    console.error("[preferencesController] savePreferences error:", err);
    return res.status(500).json({ error: "Failed to save preferences" });
  }
}
