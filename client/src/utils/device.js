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

