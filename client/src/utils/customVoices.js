const CUSTOM_VOICES_STORAGE_KEY = "family_custom_voices";
const memoryAudioSamples = new Map();

/**
 * Load all custom voice profiles from localStorage.
 * @returns {Array<Object>}
 */
export function loadCustomVoices() {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(CUSTOM_VOICES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    return list.map((item) => {
      if (!item.audioDataUrl && memoryAudioSamples.has(item.id)) {
        return { ...item, audioDataUrl: memoryAudioSamples.get(item.id) };
      }
      return item;
    });
  } catch (err) {
    console.warn("Failed to load custom voices:", err);
    return [];
  }
}

/**
 * Save a new custom voice profile or update an existing one.
 * @param {Object} voiceProfile
 * @param {string} voiceProfile.name - e.g. "Mom's Bedtime Voice"
 * @param {string} voiceProfile.role - e.g. "Mom", "Dad", "Grandma"
 * @param {string} [voiceProfile.baseVoice] - Baseline Polly voice (Joanna, Matthew, Emma, Ivy)
 * @param {string} [voiceProfile.audioDataUrl] - base64/data URL of recorded voice sample
 * @returns {Object} The saved voice profile
 */
export function saveCustomVoice({ name, role = "Family", baseVoice = "Joanna", audioDataUrl = "" }) {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  const cleanBaseVoice = baseVoice || "Joanna";
  const existing = loadCustomVoices();
  const id = `custom_${cleanBaseVoice.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newProfile = {
    id,
    name: name.trim() || `${role}'s Voice`,
    displayName: name.trim() || `${role}'s Voice`,
    tagline: `Recorded Voice • ${role}`,
    description: `Personalized voice clone for bedtime stories read by ${name || role}.`,
    avatar: role.toLowerCase().includes("dad") ? "👨" : role.toLowerCase().includes("mom") ? "👩" : role.toLowerCase().includes("grand") ? "👵" : "🎙️",
    pitch: cleanBaseVoice === "Matthew" ? "Deep baritone" : cleanBaseVoice === "Ivy" ? "Bright & youthful" : "Warm storyteller",
    previewSnippet: "The stars are shining softly tonight. Close your eyes and dream of magic.",
    baseVoice: cleanBaseVoice,
    audioDataUrl,
    isCustom: true,
    createdAt: new Date().toISOString(),
  };

  if (audioDataUrl) {
    memoryAudioSamples.set(id, audioDataUrl);
  }

  try {
    const updated = [newProfile, ...existing];
    window.localStorage.setItem(CUSTOM_VOICES_STORAGE_KEY, JSON.stringify(updated));
    return newProfile;
  } catch (err) {
    console.warn("Primary save failed, storing sample in memory and metadata in storage:", err);
    try {
      const fallbackProfile = { ...newProfile, audioDataUrl: "" };
      const updatedFallback = [fallbackProfile, ...existing];
      window.localStorage.setItem(CUSTOM_VOICES_STORAGE_KEY, JSON.stringify(updatedFallback));
      // Return full profile so server sync receives the complete audioDataUrl
      return newProfile;
    } catch (fallbackErr) {
      console.error("Failed to save custom voice even with fallback:", fallbackErr);
      return newProfile;
    }
  }
}

/**
 * Find a custom voice by ID.
 * @param {string} voiceId
 * @returns {Object | null}
 */
export function getCustomVoice(voiceId) {
  if (!voiceId || !voiceId.startsWith("custom")) return null;
  const list = loadCustomVoices();
  const found = list.find((v) => v.id === voiceId) || null;
  if (found && !found.audioDataUrl && memoryAudioSamples.has(voiceId)) {
    return { ...found, audioDataUrl: memoryAudioSamples.get(voiceId) };
  }
  return found;
}

/**
 * Delete a custom voice profile by ID.
 * @param {string} voiceId
 * @returns {boolean}
 */
export function deleteCustomVoice(voiceId) {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }
  try {
    const existing = loadCustomVoices();
    const filtered = existing.filter((v) => v.id !== voiceId);
    window.localStorage.setItem(CUSTOM_VOICES_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error("Failed to delete custom voice:", err);
    return false;
  }
}

/**
 * Sync a custom voice directly to the server database for family-wide sharing.
 * @param {string} apiBase
 * @param {string} deviceId
 * @param {string} userId
 * @param {Object} voiceProfile
 * @returns {Promise<boolean>}
 */
export async function syncCustomVoiceToServer(apiBase, deviceId, userId, voiceProfile) {
  if (!apiBase || !voiceProfile?.id) return false;
  try {
    const res = await fetch(`${apiBase}/api/preferences/custom-voices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-id": deviceId || "",
        "x-user-id": userId || "",
      },
      body: JSON.stringify({
        deviceId,
        userId,
        voice: voiceProfile,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn("[customVoices] Failed to sync custom voice to server:", err.message);
    return false;
  }
}

/**
 * Delete a custom voice from the server database.
 * @param {string} apiBase
 * @param {string} voiceId
 * @param {string} [deviceId]
 * @param {string} [userId]
 * @returns {Promise<boolean>}
 */
export async function deleteCustomVoiceFromServer(apiBase, voiceId, deviceId, userId) {
  if (!apiBase || !voiceId) return false;
  try {
    const res = await fetch(`${apiBase}/api/preferences/custom-voices/${encodeURIComponent(voiceId)}`, {
      method: "DELETE",
      headers: {
        "x-device-id": deviceId || "",
        "x-user-id": userId || "",
      },
    });
    return res.ok;
  } catch (err) {
    console.warn("[customVoices] Failed to delete custom voice from server:", err.message);
    return false;
  }
}

