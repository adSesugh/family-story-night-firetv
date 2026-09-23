import { StorageService } from "./storage";
import { loadSettings, saveSettings } from "./parentSettings";

const PREFERENCES_KEY = "familyStoryNight_userPreferences";

export async function fetchPreferencesFromServer(apiBase, deviceId) {
  if (!apiBase || !deviceId) return null;
  try {
    const res = await fetch(`${apiBase}/api/preferences?deviceId=${encodeURIComponent(deviceId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.preferences) {
      const prefs = data.preferences;
      // Sync parent settings if present
      if (prefs.parentSettings || prefs.pinHash) {
        const currentParent = loadSettings();
        saveSettings({
          pinHash: prefs.pinHash || currentParent.pinHash,
          settings: {
            ...currentParent.settings,
            ...(prefs.parentSettings || {}),
          },
        });
      }
      StorageService.setItem(PREFERENCES_KEY, prefs);
      return prefs;
    }
  } catch (err) {
    console.warn("[userPreferences] Could not fetch preferences from SQLite server:", err.message);
  }
  return null;
}

export async function syncPreferencesToServer(apiBase, deviceId, prefs = {}) {
  if (!apiBase || !deviceId) return false;
  try {
    const parent = loadSettings();
    const payload = {
      deviceId,
      preferences: {
        pinHash: parent.pinHash,
        parentSettings: parent.settings,
        voiceId: prefs.voiceId || prefs.voice || "Joanna",
        storyLength: prefs.storyLength || 6,
        themeIndex: prefs.themeIndex ?? 0,
        storyCategory: prefs.storyCategory || "all",
        illustrationStyle: prefs.illustrationStyle || "watercolor",
        ...prefs,
      },
    };

    const res = await fetch(`${apiBase}/api/preferences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.warn("[userPreferences] Could not sync preferences to SQLite server:", err.message);
    return false;
  }
}
