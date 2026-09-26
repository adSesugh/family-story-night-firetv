import { StorageService } from "./storage";
import { loadSettings, saveSettings } from "./parentSettings";
import { getUserId } from "./device";
import { loadCustomVoices } from "./customVoices";
import { normalizeCategory } from "../constants/themes";

const PREFERENCES_KEY = "familyStoryNight_userPreferences";
const CUSTOM_VOICES_STORAGE_KEY = "family_custom_voices";

export async function fetchPreferencesFromServer(apiBase, deviceId, userId = getUserId()) {
  if (!apiBase || !deviceId) return null;
  try {
    const url = new URL(`${apiBase}/api/preferences`);
    url.searchParams.set("deviceId", deviceId);
    if (userId) {
      url.searchParams.set("userId", userId);
    }

    const res = await fetch(url.toString(), {
      headers: {
        "x-device-id": deviceId,
        "x-user-id": userId || "",
      },
    });
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

      // Sync custom voices from server into local storage for this family
      if (Array.isArray(prefs.customVoices) && prefs.customVoices.length > 0) {
        const localVoices = loadCustomVoices();
        const mergedMap = new Map();
        // Server voices first
        for (const sv of prefs.customVoices) {
          if (sv && sv.id) mergedMap.set(sv.id, sv);
        }
        // Preserve any local voices that were saved before sync
        for (const lv of localVoices) {
          if (lv && lv.id && !mergedMap.has(lv.id)) {
            mergedMap.set(lv.id, lv);
          }
        }
        const mergedList = Array.from(mergedMap.values());
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(CUSTOM_VOICES_STORAGE_KEY, JSON.stringify(mergedList));
        }
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
    const userId = prefs.userId || getUserId();
    const customVoices = prefs.customVoices !== undefined ? prefs.customVoices : loadCustomVoices();

    const payload = {
      deviceId,
      userId,
      preferences: {
        userId,
        pinHash: parent.pinHash,
        parentSettings: parent.settings,
        voiceId: prefs.voiceId || prefs.voice || "Joanna",
        storyLength: prefs.storyLength || 6,
        themeIndex: prefs.themeIndex ?? 0,
        storyCategory: normalizeCategory(prefs.storyCategory),
        illustrationStyle: prefs.illustrationStyle || "watercolor",
        customVoices,
        ...prefs,
      },
    };

    const res = await fetch(`${apiBase}/api/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-id": deviceId,
        "x-user-id": userId,
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.warn("[userPreferences] Could not sync preferences to SQLite server:", err.message);
    return false;
  }
}

