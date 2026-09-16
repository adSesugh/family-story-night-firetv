import { StorageService } from "./storage";

export const ANALYTICS_STORAGE_KEY = "familyStoryNight_analytics";

/**
 * Track an analytics event.
 * @param {string} type
 * @param {object} data
 */
export function trackEvent(type, data = {}) {
  try {
    const existing = loadEvents();
    const event = {
      timestamp: new Date().toISOString(),
      type,
      data,
    };
    StorageService.setItem(ANALYTICS_STORAGE_KEY, {
      events: [...existing, event],
      version: 1,
    });
  } catch {
    // Silently no-op if storage is unavailable or throws
  }
}

/**
 * Load all recorded events from storage.
 * @returns {Array<{ timestamp: string, type: string, data: object }>}
 */
export function loadEvents() {
  try {
    const record = StorageService.getItem(ANALYTICS_STORAGE_KEY);
    if (!record || !Array.isArray(record.events)) return [];
    return record.events;
  } catch {
    return [];
  }
}

/**
 * Clear all recorded analytics events.
 */
export function clearEvents() {
  try {
    StorageService.removeItem(ANALYTICS_STORAGE_KEY);
  } catch {
    // Silently no-op
  }
}

/**
 * Summarize analytics metrics from recorded events.
 * @returns {{
 *   totalStories: number,
 *   mostPopularTheme: string,
 *   avgCompletionRate: number,
 *   topFamilyMembers: string[],
 *   favoriteVoice: string
 * }}
 */
export function summarize() {
  const events = loadEvents();
  if (events.length === 0) {
    return {
      totalStories: 0,
      mostPopularTheme: "None",
      avgCompletionRate: 0,
      topFamilyMembers: [],
      favoriteVoice: "None",
    };
  }

  const generatedEvents = events.filter((e) => e.type === "story_generated");
  const completedEvents = events.filter((e) => e.type === "story_completed");

  const totalStories = generatedEvents.length;

  // Most popular theme
  const themeCounts = {};
  for (const e of generatedEvents) {
    const theme = e.data?.theme;
    if (theme) {
      themeCounts[theme] = (themeCounts[theme] || 0) + 1;
    }
  }
  let mostPopularTheme = "None";
  let maxThemeCount = 0;
  for (const [theme, count] of Object.entries(themeCounts)) {
    if (count > maxThemeCount) {
      maxThemeCount = count;
      mostPopularTheme = theme;
    }
  }

  // Completion rate (percentage)
  const avgCompletionRate =
    totalStories > 0 ? Math.min(100, Math.round((completedEvents.length / totalStories) * 100)) : 0;

  // Top family members
  const memberCounts = {};
  for (const e of generatedEvents) {
    const members = e.data?.familyMembers;
    if (Array.isArray(members)) {
      for (const m of members) {
        if (m) {
          memberCounts[m] = (memberCounts[m] || 0) + 1;
        }
      }
    }
  }
  const topFamilyMembers = Object.entries(memberCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([member]) => member)
    .slice(0, 5);

  // Favorite voice
  const voiceCounts = {};
  for (const e of generatedEvents) {
    const voice = e.data?.voice || e.data?.voiceSelected;
    if (voice) {
      voiceCounts[voice] = (voiceCounts[voice] || 0) + 1;
    }
  }
  let favoriteVoice = "None";
  let maxVoiceCount = 0;
  for (const [voice, count] of Object.entries(voiceCounts)) {
    if (count > maxVoiceCount) {
      maxVoiceCount = count;
      favoriteVoice = voice;
    }
  }

  return {
    totalStories,
    mostPopularTheme,
    avgCompletionRate,
    topFamilyMembers,
    favoriteVoice,
  };
}
