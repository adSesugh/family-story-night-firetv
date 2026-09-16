import { StorageService } from "./storage";

/**
 * @typedef {{ text: string, illustration?: { url: string, alt: string } | null }} StoryPage
 * @typedef {{ id: string, generatedAt: string, familyMembers: string[], theme: string, pages: (string|StoryPage)[], firstPage: string }} Story
 */

const STORAGE_KEY = "familyStoryNight_history";
const MAX_STORIES = 50;

/**
 * Save a new story to history. Assigns a UUID and generatedAt timestamp.
 * Enforces the 50-story cap by dropping the oldest entry when full.
 *
 * @param {Omit<Story, 'id' | 'generatedAt'>} story
 * @returns {Story} The saved story (with id and generatedAt filled in)
 */
export function saveStory(story) {
  const saved = {
    ...story,
    id: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
  };

  const existing = loadHistory();

  // Enforce cap: drop oldest entries (front of array) until we have room
  const trimmed = existing.length >= MAX_STORIES
    ? existing.slice(existing.length - MAX_STORIES + 1)
    : existing;

  StorageService.setItem(STORAGE_KEY, { stories: [...trimmed, saved], version: 1 });

  return saved;
}

/**
 * Update an existing story in history by id (e.g. to attach newly generated illustrations).
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
    stories[index] = { ...stories[index], ...updates };
    StorageService.setItem(STORAGE_KEY, { stories, version: 1 });
    return stories[index];
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
  StorageService.setItem(STORAGE_KEY, { stories, version: 1 });
}

/**
 * Remove all stories from history.
 */
export function clearHistory() {
  StorageService.removeItem(STORAGE_KEY);
}
