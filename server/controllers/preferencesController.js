import {
  getPreferences,
  savePreferences,
  getCustomVoices,
  saveCustomVoiceRecord,
  deleteCustomVoiceRecord,
} from "../db.js";
import { cloneVoiceWithKokoro } from "../services/kokoroVoiceService.js";

function extractDeviceId(req) {
  return (
    req.query?.deviceId ||
    req.headers?.["x-device-id"] ||
    req.body?.deviceId ||
    null
  );
}

function extractUserId(req) {
  return (
    req.query?.userId ||
    req.headers?.["x-user-id"] ||
    req.body?.userId ||
    req.body?.preferences?.userId ||
    null
  );
}

/**
 * GET /api/preferences
 * Query: ?deviceId=...&userId=...
 */
export function getPreferencesHandler(req, res) {
  try {
    const deviceId = extractDeviceId(req);
    const userId = extractUserId(req);

    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }

    const preferences = getPreferences(deviceId, userId);
    return res.json({ preferences: preferences || null });
  } catch (err) {
    console.error("[preferencesController] getPreferences error:", err);
    return res.status(500).json({ error: "Failed to fetch preferences" });
  }
}

/**
 * POST /api/preferences
 * Body: { deviceId, userId, preferences }
 */
export function savePreferencesHandler(req, res) {
  try {
    const deviceId = extractDeviceId(req);
    const userId = extractUserId(req);
    const prefs = req.body?.preferences || req.body || {};

    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }

    if (userId && !prefs.userId) {
      prefs.userId = userId;
    }

    const updated = savePreferences(deviceId, prefs);

    // If custom voices were sent, trigger Kokoro clone registration in background
    if (Array.isArray(prefs.customVoices) && prefs.customVoices.length > 0) {
      for (const cv of prefs.customVoices) {
        if (cv?.id && (cv.id.startsWith("custom") || cv.isCustom)) {
          cloneVoiceWithKokoro({
            voiceId: cv.id,
            name: cv.name || cv.displayName,
            role: cv.role,
            baseVoice: cv.baseVoice || "Joanna",
            audioSample: cv.audioDataUrl || cv.audioData || null,
          }).catch((e) => console.warn(`[preferences] Background Kokoro clone note:`, e.message));
        }
      }
    }

    return res.json({ success: true, preferences: updated });
  } catch (err) {
    console.error("[preferencesController] savePreferences error:", err);
    return res.status(500).json({ error: "Failed to save preferences" });
  }
}

/**
 * GET /api/preferences/custom-voices
 * Query: ?userId=...&deviceId=...
 */
export function getCustomVoicesHandler(req, res) {
  try {
    const userId = extractUserId(req);
    const deviceId = extractDeviceId(req);

    const voices = getCustomVoices({ userId, deviceId });
    return res.json({ voices });
  } catch (err) {
    console.error("[preferencesController] getCustomVoices error:", err);
    return res.status(500).json({ error: "Failed to fetch custom voices" });
  }
}

/**
 * POST /api/preferences/custom-voices
 * Body: { deviceId, userId, voice: { id, name, role, baseVoice, audioDataUrl, ... } }
 */
export async function saveCustomVoiceHandler(req, res) {
  try {
    const deviceId = extractDeviceId(req);
    const userId = extractUserId(req);
    const voice = req.body?.voice || req.body;

    if (!voice || !voice.id) {
      return res.status(400).json({ error: "voice.id is required" });
    }

    const saved = saveCustomVoiceRecord(voice, deviceId, userId);

    // Register with Kokoro voice microservice
    cloneVoiceWithKokoro({
      voiceId: voice.id,
      name: voice.name || voice.displayName,
      role: voice.role,
      baseVoice: voice.baseVoice || "Joanna",
      audioSample: voice.audioDataUrl || voice.audioData || null,
    }).catch((e) => console.warn(`[preferences] Background Kokoro clone note:`, e.message));

    return res.json({ success: true, voice: saved });
  } catch (err) {
    console.error("[preferencesController] saveCustomVoice error:", err);
    return res.status(500).json({ error: "Failed to save custom voice" });
  }
}

/**
 * DELETE /api/preferences/custom-voices/:id
 */
export function deleteCustomVoiceHandler(req, res) {
  try {
    const voiceId = req.params.id;
    if (!voiceId) {
      return res.status(400).json({ error: "Voice ID is required" });
    }
    const success = deleteCustomVoiceRecord(voiceId);
    return res.json({ success });
  } catch (err) {
    console.error("[preferencesController] deleteCustomVoice error:", err);
    return res.status(500).json({ error: "Failed to delete custom voice" });
  }
}

