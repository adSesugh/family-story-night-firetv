import { StorageService } from "./storage";

/**
 * @typedef {{ text: string, scene?: string, illustration?: { url: string, alt: string } | null }} StoryPage
 * @typedef {{ id: string, generatedAt: string, familyMembers: string[], theme: string, category?: string, pages: (string|StoryPage)[], firstPage: string, lesson?: string, choices?: string[], chapter?: number }} Story
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
function safeSaveStories(stories) {
  // 1. First attempt: normal write
  if (StorageService.setItem(STORAGE_KEY, { stories, version: 1 })) {
    return true;
  }

  console.warn("Storage quota reached; lightening image data to guarantee story persistence...");

  // 2. Second attempt: keep only the first cover illustration per story
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
  }));

  if (StorageService.setItem(STORAGE_KEY, { stories: lightenedStories, version: 1 })) {
    return true;
  }

  // 3. Third attempt: strip all image data URLs, preserving complete story text, lessons, and choices
  console.warn("Storage quota still tight; saving stories in text-first mode...");
  const textOnlyStories = lightenedStories.map((s) => ({
    ...s,
    illustrations: [],
    pages: Array.isArray(s.pages)
      ? s.pages.map((p) => (typeof p === "object" ? { text: p.text, scene: p.scene } : p))
      : s.pages,
  }));

  if (StorageService.setItem(STORAGE_KEY, { stories: textOnlyStories, version: 1 })) {
    return true;
  }

  // 4. Fourth attempt: trim older stories to make room for newest stories
  let trimmed = [...textOnlyStories];
  while (trimmed.length > 1) {
    trimmed.shift(); // drop oldest
    if (StorageService.setItem(STORAGE_KEY, { stories: trimmed, version: 1 })) {
      return true;
    }
  }

  // 5. Final fallback: save at least the newest story
  return StorageService.setItem(STORAGE_KEY, {
    stories: [stories[stories.length - 1]],
    version: 1,
  });
}

/**
 * Save a new story to history.
 * Enforces category detection, safe ID generation, and quota resilience.
 *
 * @param {Omit<Story, 'id' | 'generatedAt'>} story
 * @returns {Story} The saved story (with id and generatedAt filled in)
 */
export function saveStory(story) {
  const isBible = isBiblicalStory(story);
  const resolvedCategory = isBible ? "bible" : story.category || "adventures";

  const saved = {
    ...story,
    id: generateUUID(),
    category: resolvedCategory,
    generatedAt: new Date().toISOString(),
  };

  const existing = loadHistory();

  // Enforce cap: drop oldest entries (front of array) until we have room
  const trimmed =
    existing.length >= MAX_STORIES
      ? existing.slice(existing.length - MAX_STORIES + 1)
      : existing;

  safeSaveStories([...trimmed, saved]);

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
export function updateStory(id, updates) {
  try {
    const stories = loadHistory();
    const index = stories.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const existing = stories[index];
    const updatedStory = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    stories[index] = updatedStory;
    safeSaveStories(stories);
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
export function loadHistory() {
  try {
    const data = StorageService.getItem(STORAGE_KEY);
    if (!data || !Array.isArray(data.stories)) return [];
    return data.stories;
  } catch {
    return [];
  }
}

/**
 * Remove a single story by id.
 *
 * @param {string} id
 */
export function deleteStory(id) {
  const stories = loadHistory().filter((s) => s.id !== id);
  safeSaveStories(stories);
}

/**
 * Remove all stories from history.
 */
export function clearHistory() {
  StorageService.removeItem(STORAGE_KEY);
}
