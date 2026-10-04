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
        saveSettings({
          pinHash: prefs.pinHash || null,
          settings: {
            strictThemes: false,
            timeLimitMinutes: 0,
            readingLevels: ["3+", "5+", "8+"],
            bedtimeThemeLocked: false,
            ...(prefs.parentSettings || {}),
          },
        });
      } else {
        saveSettings({
          pinHash: null,
          settings: {
            strictThemes: false,
            timeLimitMinutes: 0,
            readingLevels: ["3+", "5+", "8+"],
            bedtimeThemeLocked: false,
          },
        });
      }

      if (prefs.voiceId) StorageService.setItem("familyStoryNight_voice", prefs.voiceId);
      if (prefs.storyLength) {
        StorageService.setItem("familyStoryNight_storyLength", prefs.storyLength);
        StorageService.setItem("familyStoryNight_story_length", prefs.storyLength);
      }
      if (prefs.illustrationStyle) {
        StorageService.setItem("familyStoryNight_illustrationStyle", prefs.illustrationStyle);
        StorageService.setItem("familyStoryNight_illustration_style", prefs.illustrationStyle);
      }
      if (prefs.storyCategory) {
        StorageService.setItem("familyStoryNight_category", normalizeCategory(prefs.storyCategory));
      }

      // Sync custom voices from server into local storage for this family.
      // We set exactly this family's custom voices so previous account voices never leak.
      const familyVoices = Array.isArray(prefs.customVoices) ? prefs.customVoices : [];
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(CUSTOM_VOICES_STORAGE_KEY, JSON.stringify(familyVoices));
      }

      StorageService.setItem(PREFERENCES_KEY, prefs);
      return prefs;
    } else if (userId) {
      // Default clean preferences for newly linked family account
      const defaultPrefs = {
        deviceId,
        userId,
        voiceId: "Joanna",
        storyLength: 6,
        themeIndex: 0,
        storyCategory: "adventures",
        illustrationStyle: "watercolor",
        customVoices: [],
        pinHash: null,
        parentSettings: null,
      };
      saveSettings({
        pinHash: null,
        settings: {
          strictThemes: false,
          timeLimitMinutes: 0,
          readingLevels: ["3+", "5+", "8+"],
          bedtimeThemeLocked: false,
        },
      });
      StorageService.setItem("familyStoryNight_voice", "Joanna");
      StorageService.setItem("familyStoryNight_storyLength", 6);
      StorageService.setItem("familyStoryNight_story_length", 6);
      StorageService.setItem("familyStoryNight_illustrationStyle", "watercolor");
      StorageService.setItem("familyStoryNight_illustration_style", "watercolor");
      StorageService.setItem("familyStoryNight_category", "adventures");
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(CUSTOM_VOICES_STORAGE_KEY, JSON.stringify([]));
      }
      StorageService.setItem(PREFERENCES_KEY, defaultPrefs);
      return defaultPrefs;
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

