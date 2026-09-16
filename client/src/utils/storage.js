/**
 * StorageService — thin wrapper around localStorage with graceful error handling.
 * All methods catch SecurityError and QuotaExceededError so callers never need
 * to worry about unavailable or full storage.
 */
export const StorageService = {
  /**
   * Read and JSON-parse a value from localStorage.
   * @param {string} key
   * @returns {any | null} Parsed value, or null if absent / on error
   */
  getItem(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /**
   * JSON-serialize and write a value to localStorage.
   * @param {string} key
   * @param {any} value
   * @returns {boolean} true on success, false on error
   */
  setItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Remove a key from localStorage.
   * @param {string} key
   * @returns {boolean} true on success, false on error
   */
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * Check whether localStorage is available and usable in this environment.
 * @returns {boolean}
 */
export function isStorageAvailable() {
  const TEST_KEY = "__fsn_storage_test__";
  try {
    localStorage.setItem(TEST_KEY, "1");
    const ok = localStorage.getItem(TEST_KEY) === "1";
    localStorage.removeItem(TEST_KEY);
    return ok;
  } catch {
    return false;
  }
}
