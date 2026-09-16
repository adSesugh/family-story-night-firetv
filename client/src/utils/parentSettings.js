import { StorageService } from "./storage";

export const PARENT_SETTINGS_KEY = "familyStoryNight_parentSettings";

export const DEFAULT_PARENT_SETTINGS = {
  pinHash: null,
  settings: {
    allowCustomThemes: true,
    allowHistory: true,
    ageRestriction: "all",
    defaultVoice: "Joanna",
    lockedUntil: null,
  },
};

/**
 * Deterministic hash for family-friendly PIN obfuscation.
 * @param {string} pin
 * @returns {string}
 */
export function hashPin(pin) {
  if (typeof pin !== "string" && typeof pin !== "number") return "";
  return btoa(String(pin) + "fsn-salt");
}

/**
 * Verify a PIN against a stored hash.
 * @param {string} pin
 * @param {string | null} pinHash
 * @returns {boolean}
 */
export function verifyPin(pin, pinHash) {
  if (!pinHash || !pin) return false;
  return hashPin(pin) === pinHash;
}

/**
 * Load parent settings from localStorage. Returns defaults if absent or corrupted.
 * @returns {typeof DEFAULT_PARENT_SETTINGS}
 */
export function loadSettings() {
  const data = StorageService.getItem(PARENT_SETTINGS_KEY);
  if (!data || typeof data !== "object") {
    return { ...DEFAULT_PARENT_SETTINGS, settings: { ...DEFAULT_PARENT_SETTINGS.settings } };
  }
  return {
    pinHash: data.pinHash ?? null,
    settings: {
      ...DEFAULT_PARENT_SETTINGS.settings,
      ...(data.settings || {}),
    },
  };
}

/**
 * Save parent settings to localStorage.
 * @param {typeof DEFAULT_PARENT_SETTINGS} settingsObj
 * @returns {boolean}
 */
export function saveSettings(settingsObj) {
  return StorageService.setItem(PARENT_SETTINGS_KEY, settingsObj);
}

/**
 * Set and persist a new PIN.
 * @param {string} pin
 * @returns {typeof DEFAULT_PARENT_SETTINGS}
 */
export function setPin(pin) {
  const current = loadSettings();
  const updated = {
    ...current,
    pinHash: hashPin(pin),
  };
  saveSettings(updated);
  return updated;
}
