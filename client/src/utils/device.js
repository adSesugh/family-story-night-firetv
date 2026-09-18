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
