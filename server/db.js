import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function initDatabase(dbPath = process.env.DB_PATH) {
  let resolvedPath = dbPath;
  if (!resolvedPath || resolvedPath !== ":memory:") {
    const dataDir = path.join(__dirname, "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    resolvedPath = resolvedPath || path.join(dataDir, "family_story_night.db");
  }

  const db = new Database(resolvedPath);

  // Enable WAL mode for better concurrency and write performance
  if (resolvedPath !== ":memory:") {
    db.pragma("journal_mode = WAL");
  }

  if (process.env.NODE_ENV !== "test") {
    console.log(`[DB] SQLite database initialized at: ${resolvedPath}`);
  }

  // Schema migrations
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      device_id TEXT PRIMARY KEY,
      user_id TEXT,
      paired_alexa_code TEXT,
      created_at TEXT NOT NULL,
      last_active_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS preferences (
      device_id TEXT PRIMARY KEY,
      user_id TEXT,
      pin_hash TEXT,
      parent_settings_json TEXT,
      voice_id TEXT DEFAULT 'Joanna',
      story_length INTEGER DEFAULT 6,
      theme_index INTEGER DEFAULT 0,
      story_category TEXT DEFAULT 'all',
      illustration_style TEXT DEFAULT 'watercolor',
      custom_voices_json TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      user_id TEXT,
      family_members_json TEXT,
      theme TEXT,
      category TEXT,
      chapter INTEGER DEFAULT 1,
      lesson TEXT,
      choices_json TEXT,
      first_page TEXT,
      is_favorite INTEGER DEFAULT 0,
      pages_json TEXT,
      illustrations_json TEXT,
      chapters_json TEXT,
      narrations_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_stories_device_updated ON stories(device_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS narrations (
      id TEXT PRIMARY KEY,
      story_id TEXT,
      device_id TEXT,
      page_index INTEGER,
      voice_id TEXT NOT NULL,
      text_hash TEXT NOT NULL,
      audio_data TEXT NOT NULL,
      speech_marks_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_narrations_lookup ON narrations(text_hash, voice_id);
    CREATE INDEX IF NOT EXISTS idx_narrations_story ON narrations(story_id, page_index);
  `);

  // Migration for existing databases that don't have narrations_json column
  try {
    db.exec(`ALTER TABLE stories ADD COLUMN narrations_json TEXT`);
  } catch (_e) {
    // Column already exists
  }

  return db;
}

// Singleton database instance
export const db = initDatabase();

// --- Device Helpers ---
export function upsertDevice(deviceId, userId = null) {
  if (!deviceId) return null;
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO devices (device_id, user_id, created_at, last_active_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET
      user_id = COALESCE(excluded.user_id, devices.user_id),
      last_active_at = excluded.last_active_at
  `);
  stmt.run(deviceId, userId, now, now);
  return { deviceId, userId };
}

// --- Preferences Helpers ---
export function getPreferences(deviceId) {
  if (!deviceId) return null;
  const stmt = db.prepare(`SELECT * FROM preferences WHERE device_id = ?`);
  const row = stmt.get(deviceId);
  if (!row) return null;

  return {
    deviceId: row.device_id,
    userId: row.user_id,
    pinHash: row.pin_hash,
    parentSettings: row.parent_settings_json ? JSON.parse(row.parent_settings_json) : null,
    voiceId: row.voice_id,
    storyLength: row.story_length,
    themeIndex: row.theme_index,
    storyCategory: row.story_category,
    illustrationStyle: row.illustration_style,
    customVoices: row.custom_voices_json ? JSON.parse(row.custom_voices_json) : [],
    updatedAt: row.updated_at,
  };
}

export function savePreferences(deviceId, prefs = {}) {
  if (!deviceId) throw new Error("deviceId is required");
  upsertDevice(deviceId, prefs.userId);

  const now = new Date().toISOString();
  const parentSettingsJson = prefs.parentSettings ? JSON.stringify(prefs.parentSettings) : null;
  const customVoicesJson = prefs.customVoices ? JSON.stringify(prefs.customVoices) : null;

  const stmt = db.prepare(`
    INSERT INTO preferences (
      device_id, user_id, pin_hash, parent_settings_json,
      voice_id, story_length, theme_index, story_category,
      illustration_style, custom_voices_json, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET
      user_id = COALESCE(excluded.user_id, preferences.user_id),
      pin_hash = COALESCE(excluded.pin_hash, preferences.pin_hash),
      parent_settings_json = COALESCE(excluded.parent_settings_json, preferences.parent_settings_json),
      voice_id = COALESCE(excluded.voice_id, preferences.voice_id),
      story_length = COALESCE(excluded.story_length, preferences.story_length),
      theme_index = COALESCE(excluded.theme_index, preferences.theme_index),
      story_category = COALESCE(excluded.story_category, preferences.story_category),
      illustration_style = COALESCE(excluded.illustration_style, preferences.illustration_style),
      custom_voices_json = COALESCE(excluded.custom_voices_json, preferences.custom_voices_json),
      updated_at = excluded.updated_at
  `);

  stmt.run(
    deviceId,
    prefs.userId || null,
    prefs.pinHash !== undefined ? prefs.pinHash : null,
    parentSettingsJson,
    prefs.voiceId || "Joanna",
    prefs.storyLength || 6,
    prefs.themeIndex !== undefined ? prefs.themeIndex : 0,
    prefs.storyCategory || "all",
    prefs.illustrationStyle || "watercolor",
    customVoicesJson,
    now
  );

  return getPreferences(deviceId);
}

// --- Stories Helpers ---
export function getStories(deviceId, limit = 50) {
  if (!deviceId) return [];
  const stmt = db.prepare(`
    SELECT * FROM stories
    WHERE device_id = ?
    ORDER BY updated_at DESC, rowid DESC
    LIMIT ?
  `);
  const rows = stmt.all(deviceId, limit);

  return rows.map((row) => ({
    id: row.id,
    deviceId: row.device_id,
    userId: row.user_id,
    familyMembers: row.family_members_json ? JSON.parse(row.family_members_json) : [],
    theme: row.theme,
    category: row.category,
    chapter: row.chapter,
    lesson: row.lesson,
    choices: row.choices_json ? JSON.parse(row.choices_json) : [],
    firstPage: row.first_page,
    isFavorite: Boolean(row.is_favorite),
    pages: row.pages_json ? JSON.parse(row.pages_json) : [],
    illustrations: row.illustrations_json ? JSON.parse(row.illustrations_json) : [],
    chapters: row.chapters_json ? JSON.parse(row.chapters_json) : [],
    narrations: row.narrations_json ? JSON.parse(row.narrations_json) : {},
    generatedAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function getStoryById(id, deviceId) {
  if (!id || !deviceId) return null;
  const stmt = db.prepare(`SELECT * FROM stories WHERE id = ? AND device_id = ?`);
  const row = stmt.get(id, deviceId);
  if (!row) return null;

  return {
    id: row.id,
    deviceId: row.device_id,
    userId: row.user_id,
    familyMembers: row.family_members_json ? JSON.parse(row.family_members_json) : [],
    theme: row.theme,
    category: row.category,
    chapter: row.chapter,
    lesson: row.lesson,
    choices: row.choices_json ? JSON.parse(row.choices_json) : [],
    firstPage: row.first_page,
    isFavorite: Boolean(row.is_favorite),
    pages: row.pages_json ? JSON.parse(row.pages_json) : [],
    illustrations: row.illustrations_json ? JSON.parse(row.illustrations_json) : [],
    chapters: row.chapters_json ? JSON.parse(row.chapters_json) : [],
    narrations: row.narrations_json ? JSON.parse(row.narrations_json) : {},
    generatedAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function saveStory(deviceId, story = {}) {
  if (!deviceId) throw new Error("deviceId is required");
  if (!story.id) throw new Error("story.id is required");

  upsertDevice(deviceId, story.userId);

  const now = new Date().toISOString();
  const createdAt = story.generatedAt || story.createdAt || now;

  // Retrieve existing story record if present to guard against client localStorage quota stripping
  const existingRow = db.prepare("SELECT * FROM stories WHERE id = ?").get(story.id);

  let finalIllustrations = Array.isArray(story.illustrations) ? [...story.illustrations] : [];
  let finalPages = Array.isArray(story.pages) ? [...story.pages] : [];
  let finalChapters = Array.isArray(story.chapters) ? [...story.chapters] : [];

  if (existingRow) {
    // 1. Guard illustrations: if incoming has 0 or fewer illustrations than DB, keep DB's illustrations
    let existingIllustrations = [];
    try {
      existingIllustrations = existingRow.illustrations_json ? JSON.parse(existingRow.illustrations_json) : [];
    } catch {
      existingIllustrations = [];
    }

    if ((!finalIllustrations || finalIllustrations.length === 0) && existingIllustrations.length > 0) {
      finalIllustrations = existingIllustrations;
    } else if (Array.isArray(finalIllustrations) && Array.isArray(existingIllustrations)) {
      const maxLen = Math.max(finalIllustrations.length, existingIllustrations.length);
      const merged = [];
      for (let i = 0; i < maxLen; i++) {
        merged[i] = finalIllustrations[i] || existingIllustrations[i] || null;
      }
      finalIllustrations = merged;
    }

    // 2. Guard pages: restore illustration property on pages if incoming pages were stripped by client
    if (existingRow.pages_json && Array.isArray(finalPages)) {
      try {
        const existingPages = JSON.parse(existingRow.pages_json);
        finalPages = finalPages.map((page, i) => {
          if (typeof page === "object" && page !== null) {
            if (!page.illustration && existingPages[i]?.illustration) {
              return { ...page, illustration: existingPages[i].illustration };
            }
          }
          return page;
        });
      } catch {
        // Keep finalPages as-is
      }
    }
  }

  const familyMembersJson = JSON.stringify(story.familyMembers || []);
  const choicesJson = JSON.stringify(story.choices || []);
  const pagesJson = JSON.stringify(finalPages);
  const illustrationsJson = JSON.stringify(finalIllustrations);
  const chaptersJson = JSON.stringify(finalChapters);
  const narrationsJson = JSON.stringify(story.narrations || {});

  const stmt = db.prepare(`
    INSERT INTO stories (
      id, device_id, user_id, family_members_json, theme, category,
      chapter, lesson, choices_json, first_page, is_favorite,
      pages_json, illustrations_json, chapters_json, narrations_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      chapter = excluded.chapter,
      lesson = excluded.lesson,
      choices_json = excluded.choices_json,
      pages_json = excluded.pages_json,
      illustrations_json = excluded.illustrations_json,
      chapters_json = excluded.chapters_json,
      narrations_json = COALESCE(excluded.narrations_json, stories.narrations_json),
      is_favorite = COALESCE(excluded.is_favorite, stories.is_favorite),
      updated_at = excluded.updated_at
  `);

  stmt.run(
    story.id,
    deviceId,
    story.userId || null,
    familyMembersJson,
    story.theme || "",
    story.category || "",
    story.chapter || 1,
    story.lesson || "",
    choicesJson,
    story.firstPage || (typeof finalPages[0] === "string" ? finalPages[0] : finalPages[0]?.text || ""),
    story.isFavorite ? 1 : 0,
    pagesJson,
    illustrationsJson,
    chaptersJson,
    narrationsJson,
    createdAt,
    now
  );

  return getStoryById(story.id, deviceId);
}

/**
 * Saves an illustration directly into a story in SQLite (persisting even if client localStorage is constrained).
 */
export function saveStoryIllustration(storyId, pageIndex, illustrationUrl, alt = "") {
  if (!storyId || pageIndex === undefined || pageIndex === null || !illustrationUrl) return null;
  const row = db.prepare("SELECT * FROM stories WHERE id = ?").get(storyId);
  if (!row) return null;

  let illustrations = [];
  try {
    illustrations = row.illustrations_json ? JSON.parse(row.illustrations_json) : [];
  } catch {
    illustrations = [];
  }
  illustrations[pageIndex] = illustrationUrl;

  let pages = [];
  try {
    pages = row.pages_json ? JSON.parse(row.pages_json) : [];
  } catch {
    pages = [];
  }
  if (pages[pageIndex]) {
    const text = typeof pages[pageIndex] === "object" ? pages[pageIndex].text : pages[pageIndex];
    const scene = typeof pages[pageIndex] === "object" ? pages[pageIndex].scene : undefined;
    pages[pageIndex] = {
      text,
      scene,
      illustration: { url: illustrationUrl, alt: alt || `Illustration for page ${pageIndex + 1}` },
    };
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE stories
    SET illustrations_json = ?, pages_json = ?, updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(illustrations), JSON.stringify(pages), now, storyId);

  return getStoryById(storyId, row.device_id);
}

/**
 * Retrieves a cached illustration for a story page from SQLite if available.
 */
export function getStoryIllustration(storyId, pageIndex) {
  if (!storyId || pageIndex === undefined || pageIndex === null) return null;
  const row = db.prepare("SELECT illustrations_json FROM stories WHERE id = ?").get(storyId);
  if (!row || !row.illustrations_json) return null;
  try {
    const illustrations = JSON.parse(row.illustrations_json);
    return illustrations[pageIndex] || null;
  } catch {
    return null;
  }
}

export function deleteStory(id, deviceId) {
  if (!id || !deviceId) return false;
  const stmt = db.prepare(`DELETE FROM stories WHERE id = ? AND device_id = ?`);
  const result = stmt.run(id, deviceId);
  return result.changes > 0;
}

export function toggleFavorite(id, deviceId) {
  if (!id || !deviceId) return null;
  const story = getStoryById(id, deviceId);
  if (!story) return null;

  const newFav = story.isFavorite ? 0 : 1;
  const stmt = db.prepare(`UPDATE stories SET is_favorite = ?, updated_at = ? WHERE id = ? AND device_id = ?`);
  stmt.run(newFav, new Date().toISOString(), id, deviceId);
  return { ...story, isFavorite: Boolean(newFav) };
}

// --- Narration Cache Helpers ---

/**
 * Retrieves cached audio and speechMarks for a given text hash and voiceId.
 * @param {string} textHash - SHA256 of normalized text
 * @param {string} voiceId - Voice identifier
 * @returns {{ id: string, audioData: string, speechMarks: Array, voiceId: string } | null}
 */
export function getNarration(textHash, voiceId) {
  if (!textHash || !voiceId) return null;
  const stmt = db.prepare(`
    SELECT * FROM narrations 
    WHERE text_hash = ? AND voice_id = ? 
    ORDER BY rowid DESC 
    LIMIT 1
  `);
  const row = stmt.get(textHash, voiceId);
  if (!row) return null;
  return {
    id: row.id,
    storyId: row.story_id,
    deviceId: row.device_id,
    pageIndex: row.page_index,
    voiceId: row.voice_id,
    textHash: row.text_hash,
    audioData: row.audio_data,
    speechMarks: row.speech_marks_json ? JSON.parse(row.speech_marks_json) : [],
    createdAt: row.created_at,
  };
}

/**
 * Persists synthesized voice audio and speech marks to SQLite.
 * Also associates with story and device if provided.
 */
export function saveNarration({ storyId = null, deviceId = null, pageIndex = null, voiceId, textHash, audioData, speechMarks = [] }) {
  if (!voiceId || !textHash || !audioData) {
    throw new Error("voiceId, textHash, and audioData are required");
  }

  const id = `${textHash}_${voiceId}`;
  const now = new Date().toISOString();
  const speechMarksJson = JSON.stringify(speechMarks || []);

  const stmt = db.prepare(`
    INSERT INTO narrations (
      id, story_id, device_id, page_index, voice_id, text_hash,
      audio_data, speech_marks_json, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      story_id = COALESCE(excluded.story_id, narrations.story_id),
      device_id = COALESCE(excluded.device_id, narrations.device_id),
      page_index = COALESCE(excluded.page_index, narrations.page_index),
      audio_data = excluded.audio_data,
      speech_marks_json = excluded.speech_marks_json
  `);

  stmt.run(
    id,
    storyId || null,
    deviceId || null,
    pageIndex !== null && pageIndex !== undefined ? Number(pageIndex) : null,
    voiceId,
    textHash,
    audioData,
    speechMarksJson,
    now
  );

  // If storyId and deviceId are provided, also update the story's narrations_json dictionary
  if (storyId && deviceId && pageIndex !== null && pageIndex !== undefined) {
    try {
      const story = getStoryById(storyId, deviceId);
      if (story) {
        const existingNarrations = story.narrations || {};
        existingNarrations[pageIndex] = {
          audio: audioData,
          speechMarks,
          voiceId,
        };
        const updateStmt = db.prepare(`UPDATE stories SET narrations_json = ?, updated_at = ? WHERE id = ? AND device_id = ?`);
        updateStmt.run(JSON.stringify(existingNarrations), now, storyId, deviceId);
      }
    } catch (e) {
      console.warn("[db] Could not update story narrations_json:", e.message);
    }
  }

  return getNarration(textHash, voiceId);
}

