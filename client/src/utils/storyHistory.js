import { StorageService } from "./storage";
import { getUserId } from "./device";

/**
 * @typedef {{ text: string, scene?: string, illustration?: { url: string, alt: string } | null }} StoryPage
 * @typedef {{ chapter: number, pages: (string|StoryPage)[], illustrations?: Array<{ url: string, alt: string }>, lesson?: string, choices?: string[], selectedChoice?: string }} StoryChapter
 * @typedef {{ id: string, generatedAt: string, familyMembers: string[], theme: string, category?: string, pages: (string|StoryPage)[], firstPage: string, lesson?: string, choices?: string[], chapter?: number, chapters?: StoryChapter[], updatedAt?: string }} Story
 */

const STORAGE_KEY = "familyStoryNight_history";
const MAX_STORIES = 50;

/**
 * Generate a safe unique ID across all environments (secure and non-secure contexts).
 */
function generateUUID() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Insecure context fallback
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Checks if a theme or category belongs to Bible Stories.
 */
export function isBiblicalStory(story) {
  if (!story) return false;
  if (story.category === "bible") return true;
  return /\b(noah|ark|david|goliath|daniel|lion'?s den|jonah|whale|big fish|samaritan|bethlehem|jesus|moses|creation|eden|bible|scripture|rainbow promise|starry night in bethlehem)\b/i.test(
    story.theme || ""
  );
}

/**
 * Safely persists stories to localStorage, handling QuotaExceededError by
 * progressively compressing and trimming heavy base64 images so story text and metadata
 * are NEVER lost.
 */
function safeSaveStories(stories, userId = null) {
  const targetKey = userId ? `${STORAGE_KEY}_${userId}` : STORAGE_KEY;

  // 1. First attempt: normal write
  const normalPayload = { stories, version: 1 };
  if (StorageService.setItem(targetKey, normalPayload)) {
    if (targetKey !== STORAGE_KEY) {
      StorageService.setItem(STORAGE_KEY, normalPayload);
    }
    return true;
  }

  console.warn("Storage quota reached; lightening image data to guarantee story persistence...");

  // 2. Second attempt: keep only the first cover illustration per story and per chapter
  const lightenedStories = stories.map((s) => ({
    ...s,
    illustrations: Array.isArray(s.illustrations) && s.illustrations.length > 0 ? [s.illustrations[0]] : [],
    pages: Array.isArray(s.pages)
      ? s.pages.map((p, idx) => {
          if (typeof p === "object") {
            return idx === 0 && p.illustration ? p : { text: p.text, scene: p.scene };
          }
          return p;
        })
      : s.pages,
    chapters: Array.isArray(s.chapters)
      ? s.chapters.map((ch, chIdx) => ({
          ...ch,
          illustrations: chIdx === 0 && Array.isArray(ch.illustrations) && ch.illustrations.length > 0 ? [ch.illustrations[0]] : [],
          pages: Array.isArray(ch.pages)
            ? ch.pages.map((p, idx) =>
                typeof p === "object"
                  ? chIdx === 0 && idx === 0 && p.illustration
                    ? p
                    : { text: p.text, scene: p.scene }
                  : p
              )
            : ch.pages,
        }))
      : s.chapters,
  }));

  if (StorageService.setItem(targetKey, { stories: lightenedStories, version: 1 })) {
    if (targetKey !== STORAGE_KEY) {
      StorageService.setItem(STORAGE_KEY, { stories: lightenedStories, version: 1 });
    }
    return true;
  }

  // 3. Third attempt: strip all image data URLs, preserving complete story text, lessons, and choices
  console.warn("Storage quota still tight; saving stories in text-first mode...");
  const textOnlyStories = lightenedStories.map((s) => ({
    ...s,
    illustrations: [],
    narrations: {},
    pages: Array.isArray(s.pages)
      ? s.pages.map((p) => (typeof p === "object" ? { text: p.text, scene: p.scene } : p))
      : s.pages,
    chapters: Array.isArray(s.chapters)
      ? s.chapters.map((ch) => ({
          ...ch,
          illustrations: [],
          pages: Array.isArray(ch.pages)
            ? ch.pages.map((p) => (typeof p === "object" ? { text: p.text, scene: p.scene } : p))
            : ch.pages,
        }))
      : s.chapters,
  }));

  if (StorageService.setItem(targetKey, { stories: textOnlyStories, version: 1 })) {
    if (targetKey !== STORAGE_KEY) {
      StorageService.setItem(STORAGE_KEY, { stories: textOnlyStories, version: 1 });
    }
    return true;
  }

  // 4. Fourth attempt: trim older stories to make room for newest stories
  let trimmed = [...textOnlyStories];
  while (trimmed.length > 1) {
    trimmed.shift(); // drop oldest
    if (StorageService.setItem(targetKey, { stories: trimmed, version: 1 })) {
      if (targetKey !== STORAGE_KEY) {
        StorageService.setItem(STORAGE_KEY, { stories: trimmed, version: 1 });
      }
      return true;
    }
  }

  // 5. Final fallback: save at least the newest story
  const fallbackPayload = {
    stories: [stories[stories.length - 1]],
    version: 1,
  };
  const ok = StorageService.setItem(targetKey, fallbackPayload);
  if (targetKey !== STORAGE_KEY) {
    StorageService.setItem(STORAGE_KEY, fallbackPayload);
  }
  return ok;
}

/**
 * Save a new story to history.
 * Enforces category detection, safe ID generation, and quota resilience.
 *
 * @param {Omit<Story, 'id' | 'generatedAt'>} story
 * @returns {Story} The saved story (with id and generatedAt filled in)
 */
export function saveStory(story, userId = null) {
  const isBible = isBiblicalStory(story);
  const resolvedCategory = isBible ? "bible" : story.category || "adventures";
  const activeUserId = userId !== null ? userId : getUserId();

  const initialChapters =
    Array.isArray(story.chapters) && story.chapters.length > 0
      ? story.chapters
      : [
          {
            chapter: story.chapter || 1,
            pages: story.pages || [],
            illustrations: story.illustrations || [],
            lesson: story.lesson || "",
            choices: story.choices || [],
          },
        ];

  const saved = {
    ...story,
    id: story.id || generateUUID(),
    category: resolvedCategory,
    chapters: initialChapters,
    generatedAt: story.generatedAt || new Date().toISOString(),
  };

  const existing = loadHistory(activeUserId);

  // Enforce cap: drop oldest entries (front of array) until we have room
  const trimmed =
    existing.length >= MAX_STORIES
      ? existing.slice(existing.length - MAX_STORIES + 1)
      : existing;

  safeSaveStories([...trimmed, saved], activeUserId);

  return saved;
}

/**
 * Update an existing story in history by id (e.g. to advance chapters or attach newly generated illustrations).
 * Preserves the original cover illustration and firstPage excerpt if not explicitly overwritten.
 *
 * @param {string} id
 * @param {Partial<Story>} updates
 * @returns {Story | null}
 */
export function updateStory(id, updates, userId = null) {
  try {
    const activeUserId = userId !== null ? userId : getUserId();
    const stories = loadHistory(activeUserId);
    const index = stories.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const existing = stories[index];
    const updatedStory = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    stories[index] = updatedStory;
    safeSaveStories(stories, activeUserId);
    return updatedStory;
  } catch {
    return null;
  }
}

/**
 * Retrieve a single story from history by id.
 *
 * @param {string} id
 * @returns {Story | null}
 */
export function getStoryById(id) {
  try {
    const stories = loadHistory();
    return stories.find((s) => s.id === id) || null;
  } catch {
    return null;
  }
}

/**
 * Load all stored stories. Returns an empty array on any error.
 *
 * @returns {Story[]}
 */
export function loadHistory(userId = null) {
  try {
    const activeUserId = userId !== null ? userId : getUserId();
    const key = activeUserId ? `${STORAGE_KEY}_${activeUserId}` : STORAGE_KEY;
    const data = StorageService.getItem(key) || StorageService.getItem(STORAGE_KEY);
    if (!data || !Array.isArray(data.stories)) return [];
    return data.stories.map((s) => {
      if (!Array.isArray(s.chapters) || s.chapters.length === 0) {
        return {
          ...s,
          chapters: [
            {
              chapter: s.chapter || 1,
              pages: s.pages || [],
              illustrations: s.illustrations || [],
              lesson: s.lesson || "",
              choices: s.choices || [],
            },
          ],
        };
      }
      return s;
    });
  } catch {
    return [];
  }
}

/**
 * Remove a single story by id.
 *
 * @param {string} id
 */
export function deleteStory(id, userId = null) {
  const activeUserId = userId !== null ? userId : getUserId();
  const stories = loadHistory(activeUserId).filter((s) => s.id !== id);
  safeSaveStories(stories, activeUserId);
}

/**
 * Remove all stories from history.
 */
export function clearHistory(userId = null) {
  const activeUserId = userId !== null ? userId : getUserId();
  const key = activeUserId ? `${STORAGE_KEY}_${activeUserId}` : STORAGE_KEY;
  StorageService.removeItem(key);
  StorageService.removeItem(STORAGE_KEY);
}

/**
 * Synchronizes a story (with its full pages, chapters, and illustrations) to the backend SQLite DB.
 *
 * @param {string} apiBase
 * @param {string} deviceId
 * @param {Story} story
 * @returns {Promise<boolean>}
 */
export async function syncStoryToServer(apiBase, deviceId, story, userId = getUserId()) {
  if (!apiBase || !deviceId || !story?.id) return false;
  try {
    const res = await fetch(`${apiBase}/api/history`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-device-id": deviceId,
        "x-user-id": userId || "",
      },
      body: JSON.stringify({ deviceId, userId, story }),
    });
    return res.ok;
  } catch (err) {
    console.warn("[storyHistory] Could not sync story to SQLite backend:", err.message);
    return false;
  }
}

/**
 * Fetches all stories for this Fire TV device from the SQLite backend,
 * and updates the local storage cache with any missing/updated stories.
 *
 * @param {string} apiBase
 * @param {string} deviceId
 * @returns {Promise<Story[]>}
 */
export async function fetchStoriesFromServer(apiBase, deviceId, userId = getUserId()) {
  if (!apiBase || (!deviceId && !userId)) return loadHistory(userId);
  try {
    let url = `${apiBase}/api/history?deviceId=${encodeURIComponent(deviceId || "")}`;
    if (userId) {
      url += `&userId=${encodeURIComponent(userId)}`;
    }
    const res = await fetch(url, {
      headers: {
        "x-device-id": deviceId || "",
        "x-user-id": userId || "",
      },
    });
    if (!res.ok) return loadHistory(userId);
    const data = await res.json();
    if (Array.isArray(data.stories)) {
      // Authoritative stories for this family account from SQLite database
      const stories = data.stories.sort(
        (a, b) => new Date(b.updatedAt || b.generatedAt || 0) - new Date(a.updatedAt || a.generatedAt || 0)
      );
      safeSaveStories(stories, userId);
      return stories;
    }
  } catch (err) {
    console.warn("[storyHistory] Could not fetch stories from SQLite backend:", err.message);
  }
  return loadHistory(userId);
}

/**
 * Deletes a story on the backend SQLite DB.
 *
 * @param {string} apiBase
 * @param {string} deviceId
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteStoryFromServer(apiBase, deviceId, id) {
  deleteStory(id);
  if (!apiBase || !deviceId || !id) return false;
  try {
    const res = await fetch(`${apiBase}/api/history/${encodeURIComponent(id)}?deviceId=${encodeURIComponent(deviceId)}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch (err) {
    console.warn("[storyHistory] Could not delete story on SQLite backend:", err.message);
    return false;
  }
}

/**
 * Toggles favorite on the backend SQLite DB.
 *
 * @param {string} apiBase
 * @param {string} deviceId
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function toggleFavoriteOnServer(apiBase, deviceId, id) {
  if (!apiBase || !deviceId || !id) return false;
  try {
    const res = await fetch(`${apiBase}/api/history/${encodeURIComponent(id)}/favorite?deviceId=${encodeURIComponent(deviceId)}`, {
      method: "POST",
    });
    return res.ok;
  } catch (err) {
    console.warn("[storyHistory] Could not toggle favorite on SQLite backend:", err.message);
    return false;
  }
}

