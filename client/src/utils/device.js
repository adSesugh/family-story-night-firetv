import { StorageService } from "./storage";

/**
 * Detects if the current user agent corresponds to an Amazon Fire TV device.
 * Based on Amazon Developer Docs: https://developer.amazon.com/docs/fire-tv/identify-fire-tv-devices.html
 *
 * Fire TV user agents typically contain:
 * - Device identifiers: AFT followed by letters (e.g., AFTS, AFTT, AFTMM, AFTN, AFTA, AFTB, etc.)
 * - Amazon WebApp Runtime / Silk-Accelerated on Android TV
 *
 * @param {string} [userAgent]
 * @returns {boolean}
 */
export function isFireTVDevice(userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "") {
  if (!userAgent) return false;
  return (
    /\bAFT[A-Z0-9]+\b/i.test(userAgent) ||
    /AmazonWebAppRuntime/i.test(userAgent) ||
    (/Silk/i.test(userAgent) && /Android/i.test(userAgent) && /TV/i.test(userAgent))
  );
}

/**
 * Returns a persistent Fire TV device identifier.
 * Stored in local storage and shared across history, preferences, and Alexa sync.
 *
 * @returns {string}
 */
export function getDeviceId() {
  const existingId = StorageService.getItem("familyStoryNight_device_id");
  if (existingId) return existingId;

  // Check if an Alexa pairing session ID already exists to unify them
  const alexaSession = StorageService.getItem("familyStoryNight_alexa_session");
  if (alexaSession) {
    StorageService.setItem("familyStoryNight_device_id", alexaSession);
    return alexaSession;
  }

  const newId = "fsn-tv-" + Math.random().toString(36).slice(2, 10);
  StorageService.setItem("familyStoryNight_device_id", newId);
  return newId;
}

/**
 * Updates the persistent Fire TV device identifier.
 *
 * @param {string} deviceId
 * @returns {string}
 */
export function setDeviceId(deviceId) {
  if (!deviceId) return getDeviceId();
  const cleanId = String(deviceId).trim();
  StorageService.setItem("familyStoryNight_device_id", cleanId);
  return cleanId;
}

/**
 * Returns a persistent User / Family account identifier.
 * Stored in local storage and shared across all children's devices
 * so custom voices and preferences sync across the family.
 *
 * @returns {string}
 */
export function getUserId() {
  const existingUserId = StorageService.getItem("familyStoryNight_user_id");
  if (existingUserId) return existingUserId;

  // Check URL query parameters (e.g. ?userId=family_123 or ?familyId=...)
  if (typeof window !== "undefined" && window.location?.search) {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlUserId = params.get("userId") || params.get("familyId") || params.get("user_id");
      if (urlUserId) {
        StorageService.setItem("familyStoryNight_user_id", urlUserId.trim());
        return urlUserId.trim();
      }
    } catch (_) {}
  }

  // Derive initial user id from device or generate a family account id
  const deviceId = getDeviceId();
  const defaultUserId = "family-" + (deviceId.replace(/^fsn-tv-/, "") || Math.random().toString(36).slice(2, 10));
  StorageService.setItem("familyStoryNight_user_id", defaultUserId);
  return defaultUserId;
}

/**
 * Sets or updates the User / Family account identifier.
 *
 * @param {string} userId
 * @returns {string}
 */
export function setUserId(userId) {
  if (!userId) return getUserId();
  const cleanId = String(userId).trim();
  StorageService.setItem("familyStoryNight_user_id", cleanId);
  return cleanId;
}


