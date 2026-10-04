import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { normalizeCategory } from "./constants/themes.js";

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
      story_category TEXT DEFAULT 'adventures',
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

    CREATE TABLE IF NOT EXISTS custom_voices (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      device_id TEXT,
      name TEXT NOT NULL,
      role TEXT,
      base_voice TEXT,
      pitch TEXT,
      avatar TEXT,
      audio_data TEXT,
      preview_snippet TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_custom_voices_user ON custom_voices(user_id);
    CREATE INDEX IF NOT EXISTS idx_custom_voices_device ON custom_voices(device_id);
    CREATE INDEX IF NOT EXISTS idx_preferences_user ON preferences(user_id);
    CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id);
  `);

  // Migration for existing databases that don't have narrations_json column
  try {
    db.exec(`ALTER TABLE stories ADD COLUMN narrations_json TEXT`);
  } catch (_e) {
    // Column already exists
  }

  // Migration for existing preferences defaulting to 'all' instead of 'adventures'
  try {
    db.exec(`UPDATE preferences SET story_category = 'adventures' WHERE story_category = 'all' OR story_category IS NULL OR story_category = ''`);
  } catch (_e) {
    // Ignore migration error
  }

  // Auto-attribute unlinked stories and custom voices to registered family accounts
  try {
    db.exec(`
      UPDATE stories 
      SET user_id = (SELECT user_id FROM devices WHERE devices.device_id = stories.device_id)
      WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM devices WHERE devices.device_id = stories.device_id AND devices.user_id IS NOT NULL);

      UPDATE stories 
      SET user_id = 'family-' || REPLACE(device_id, 'fsn-tv-', '')
      WHERE user_id IS NULL AND device_id LIKE 'fsn-tv-%';

      UPDATE custom_voices
      SET user_id = (SELECT user_id FROM devices WHERE devices.device_id = custom_voices.device_id)
      WHERE user_id IS NULL AND EXISTS (SELECT 1 FROM devices WHERE devices.device_id = custom_voices.device_id AND devices.user_id IS NOT NULL);
    `);
  } catch (_e) {
    // Ignore migration error
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

export function getDevice(deviceId) {
  if (!deviceId) return null;
  try {
    return db.prepare("SELECT * FROM devices WHERE device_id = ?").get(deviceId) || null;
  } catch (err) {
    console.error("[DB] Error getting device:", err);
    return null;
  }
}

export function getDeviceAlexaCode(deviceId) {
  if (!deviceId) return null;
  try {
    const row = db.prepare("SELECT paired_alexa_code FROM devices WHERE device_id = ?").get(deviceId);
    return row?.paired_alexa_code || null;
  } catch (err) {
    console.error("[DB] Error getting device Alexa code:", err);
    return null;
  }
}

export function saveDeviceAlexaCode(deviceId, code, userId = null) {
  if (!deviceId || !code) return null;
  try {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO devices (device_id, user_id, paired_alexa_code, created_at, last_active_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET
        paired_alexa_code = excluded.paired_alexa_code,
        user_id = COALESCE(excluded.user_id, devices.user_id),
        last_active_at = excluded.last_active_at
    `).run(deviceId, userId, code, now, now);
    return code;
  } catch (err) {
    console.error("[DB] Error saving device Alexa code:", err);
    return null;
  }
}

export function findDeviceIdByAlexaCode(code) {
  if (!code) return null;
  try {
    const row = db.prepare("SELECT device_id FROM devices WHERE paired_alexa_code = ?").get(code);
    return row?.device_id || null;
  } catch (err) {
    console.error("[DB] Error finding device by Alexa code:", err);
    return null;
  }
}

export function getMostRecentActiveDeviceId() {
  try {
    const row = db.prepare("SELECT device_id, paired_alexa_code FROM devices ORDER BY last_active_at DESC LIMIT 1").get();
    return row || null;
  } catch (err) {
    return null;
  }
}

// --- Custom Voices Helpers ---
function formatCustomVoiceRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    name: row.name,
    displayName: row.name,
    role: row.role || "Family",
    baseVoice: row.base_voice || "Joanna",
    pitch: row.pitch || (row.base_voice === "Matthew" ? "Deep baritone" : "Warm storyteller"),
    avatar: row.avatar || "🎙️",
    tagline: `Recorded Voice • ${row.role || "Family"}`,
    previewSnippet: row.preview_snippet || "The stars are shining softly tonight. Close your eyes and dream of magic.",
    audioDataUrl: row.audio_data || "",
    audioSample: row.audio_data || "",
    isCustom: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function saveCustomVoiceRecord(voice, deviceId = null, userId = null) {
  if (!voice || !voice.id) return null;
  const now = new Date().toISOString();

  // If userId not provided, try to resolve from device
  let effectiveUserId = userId || voice.userId || null;
  if (!effectiveUserId && deviceId) {
    try {
      const dev = db.prepare("SELECT user_id FROM devices WHERE device_id = ?").get(deviceId);
      if (dev?.user_id) effectiveUserId = dev.user_id;
    } catch (_) {}
  }

  const stmt = db.prepare(`
    INSERT INTO custom_voices (
      id, user_id, device_id, name, role,
      base_voice, pitch, avatar, audio_data,
      preview_snippet, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      user_id = COALESCE(excluded.user_id, custom_voices.user_id),
      device_id = COALESCE(excluded.device_id, custom_voices.device_id),
      name = excluded.name,
      role = excluded.role,
      base_voice = excluded.base_voice,
      pitch = excluded.pitch,
      avatar = excluded.avatar,
      audio_data = CASE WHEN excluded.audio_data IS NOT NULL AND excluded.audio_data != '' THEN excluded.audio_data ELSE custom_voices.audio_data END,
      preview_snippet = excluded.preview_snippet,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    voice.id,
    effectiveUserId,
    deviceId || voice.deviceId || null,
    voice.name || voice.displayName || "Family Voice",
    voice.role || "Family",
    voice.baseVoice || "Joanna",
    voice.pitch || null,
    voice.avatar || "🎙️",
    voice.audioDataUrl || voice.audioData || null,
    voice.previewSnippet || "The stars are shining softly tonight. Close your eyes and dream of magic.",
    voice.createdAt || now,
    now
  );

  return getCustomVoiceById(voice.id);
}

export function getCustomVoiceById(voiceId) {
  if (!voiceId) return null;
  const stmt = db.prepare("SELECT * FROM custom_voices WHERE id = ?");
  const row = stmt.get(voiceId);
  if (!row) return null;
  return formatCustomVoiceRow(row);
}

export function getCustomVoices({ userId = null, deviceId = null } = {}) {
  let resolvedUserId = userId;
  if (!resolvedUserId && deviceId) {
    try {
      const dev = db.prepare("SELECT user_id FROM devices WHERE device_id = ?").get(deviceId);
      if (dev?.user_id) resolvedUserId = dev.user_id;
    } catch (_) {}
  }

  let rows = [];
  if (resolvedUserId) {
    const stmt = db.prepare(`
      SELECT * FROM custom_voices
      WHERE user_id = ? OR (user_id IS NULL AND device_id = ?)
      ORDER BY updated_at DESC, created_at DESC
    `);
    rows = stmt.all(resolvedUserId, deviceId || "");
  } else if (deviceId) {
    const stmt = db.prepare(`
      SELECT * FROM custom_voices
      WHERE device_id = ?
      ORDER BY updated_at DESC, created_at DESC
    `);
    rows = stmt.all(deviceId);
  } else {
    const stmt = db.prepare(`
      SELECT * FROM custom_voices
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 100
    `);
    rows = stmt.all();
  }

  return rows.map(formatCustomVoiceRow);
}

export function deleteCustomVoiceRecord(voiceId) {
  if (!voiceId) return false;
  const stmt = db.prepare("DELETE FROM custom_voices WHERE id = ?");
  const result = stmt.run(voiceId);
  clearVoiceNarrations(voiceId);
  return result.changes > 0;
}

export function clearVoiceNarrations(voiceId) {
  if (!voiceId) return 0;
  try {
    const stmt = db.prepare("DELETE FROM narrations WHERE voice_id = ?");
    const result = stmt.run(voiceId);
    return result.changes;
  } catch (err) {
    console.warn("[db] Could not clear voice narrations:", err.message);
    return 0;
  }
}

// --- Preferences Helpers ---
export function getPreferences(deviceId, userId = null) {
  if (!deviceId && !userId) return null;

  let row = null;
  // If a family userId is provided, prioritize loading the shared family profile
  if (userId) {
    row = db.prepare(`SELECT * FROM preferences WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`).get(userId);
  }
  // Fallback to device-specific preferences ONLY if no userId was provided,
  // or if the device-specific preferences row is unassigned or belongs to this userId.
  // NEVER fall back to another family's preferences!
  if (!row && deviceId) {
    if (userId) {
      row = db.prepare(`SELECT * FROM preferences WHERE device_id = ? AND (user_id = ? OR user_id IS NULL)`).get(deviceId, userId);
    } else {
      row = db.prepare(`SELECT * FROM preferences WHERE device_id = ?`).get(deviceId);
    }
  }

  const effectiveUserId = userId || row?.user_id || null;
  const dbCustomVoices = getCustomVoices({ userId: effectiveUserId, deviceId });

  // Update devices table so this device is linked to the family account
  if (deviceId && effectiveUserId) {
    upsertDevice(deviceId, effectiveUserId);
  }

  if (!row) {
    if (effectiveUserId && dbCustomVoices.length > 0) {
      return {
        deviceId: deviceId || "default",
        userId: effectiveUserId,
        pinHash: null,
        parentSettings: null,
        voiceId: dbCustomVoices[0]?.id || "Joanna",
        storyLength: 6,
        themeIndex: 0,
        storyCategory: "adventures",
        illustrationStyle: "watercolor",
        customVoices: dbCustomVoices,
        updatedAt: new Date().toISOString(),
      };
    }
    return null;
  }

  let customVoices = dbCustomVoices;
  if (customVoices.length === 0 && row.custom_voices_json) {
    try {
      const parsed = JSON.parse(row.custom_voices_json);
      if (Array.isArray(parsed) && parsed.length > 0) {
        customVoices = parsed;
        for (const cv of parsed) {
          saveCustomVoiceRecord(cv, deviceId, effectiveUserId);
        }
      }
    } catch (_) {}
  }

  return {
    deviceId: row.device_id,
    userId: effectiveUserId,
    pinHash: row.pin_hash,
    parentSettings: row.parent_settings_json ? JSON.parse(row.parent_settings_json) : null,
    voiceId: row.voice_id,
    storyLength: row.story_length,
    themeIndex: row.theme_index,
    storyCategory: normalizeCategory(row.story_category),
    illustrationStyle: row.illustration_style,
    customVoices: customVoices || [],
    updatedAt: row.updated_at,
  };
}

export function savePreferences(deviceId, prefs = {}) {
  if (!deviceId) throw new Error("deviceId is required");
  const effectiveUserId = prefs.userId || null;
  upsertDevice(deviceId, effectiveUserId);

  // If custom voices are included, save each to custom_voices table with user_id
  if (Array.isArray(prefs.customVoices) && prefs.customVoices.length > 0) {
    for (const v of prefs.customVoices) {
      saveCustomVoiceRecord(v, deviceId, effectiveUserId);
    }
  }

  const existing = db.prepare(`SELECT * FROM preferences WHERE device_id = ?`).get(deviceId);

  const voiceId = prefs.voiceId !== undefined ? prefs.voiceId : (existing?.voice_id || "Joanna");
  const storyLength = prefs.storyLength !== undefined ? prefs.storyLength : (existing?.story_length || 6);
  const themeIndex = prefs.themeIndex !== undefined ? prefs.themeIndex : (existing?.theme_index !== undefined ? existing.theme_index : 0);
  const storyCategory = prefs.storyCategory !== undefined
    ? normalizeCategory(prefs.storyCategory)
    : (existing?.story_category ? normalizeCategory(existing.story_category) : "adventures");
  const illustrationStyle = prefs.illustrationStyle !== undefined ? prefs.illustrationStyle : (existing?.illustration_style || "watercolor");
  const pinHash = prefs.pinHash !== undefined ? prefs.pinHash : (existing?.pin_hash || null);
  const parentSettingsJson = prefs.parentSettings !== undefined
    ? (prefs.parentSettings ? JSON.stringify(prefs.parentSettings) : null)
    : (existing?.parent_settings_json || null);

  const allVoices = getCustomVoices({ userId: effectiveUserId, deviceId });
  const customVoicesJson = allVoices.length > 0
    ? JSON.stringify(allVoices)
    : (prefs.customVoices ? JSON.stringify(prefs.customVoices) : (existing?.custom_voices_json || null));

  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO preferences (
      device_id, user_id, pin_hash, parent_settings_json,
      voice_id, story_length, theme_index, story_category,
      illustration_style, custom_voices_json, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET
      user_id = COALESCE(excluded.user_id, preferences.user_id),
      pin_hash = excluded.pin_hash,
      parent_settings_json = excluded.parent_settings_json,
      voice_id = excluded.voice_id,
      story_length = excluded.story_length,
      theme_index = excluded.theme_index,
      story_category = excluded.story_category,
      illustration_style = excluded.illustration_style,
      custom_voices_json = excluded.custom_voices_json,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    deviceId,
    effectiveUserId,
    pinHash,
    parentSettingsJson,
    voiceId,
    storyLength,
    themeIndex,
    storyCategory,
    illustrationStyle,
    customVoicesJson,
    now
  );

  return getPreferences(deviceId, effectiveUserId);
}

// --- Stories Helpers ---
export function getStories(deviceId, limit = 50, userId = null) {
  if (!deviceId && !userId) return [];

  const normalizedDev = (deviceId || "").trim();
  const normalizedUser = (userId || "").trim();

  // 1. Resolve registered family userId for this device from the database
  let effectiveUserId = normalizedUser || null;
  let devRegisteredUserId = null;
  if (normalizedDev) {
    try {
      const devRow = db.prepare("SELECT user_id FROM devices WHERE device_id = ?").get(normalizedDev);
      if (devRow?.user_id) devRegisteredUserId = devRow.user_id;
    } catch (_) {}
  }

  // If the passed userId is empty or is just the default auto-generated id for this device (family-<suffix>),
  // and this device is already registered to a real family account in the DB, use the DB's family account!
  const isDefaultGeneratedUser = normalizedDev && effectiveUserId === "family-" + normalizedDev.replace(/^fsn-tv-/, "");
  if ((!effectiveUserId || isDefaultGeneratedUser) && devRegisteredUserId) {
    effectiveUserId = devRegisteredUserId;
  }

  // If the user entered a device ID (e.g. fsn-tv-...) as their userId, find its linked family account
  if (effectiveUserId && effectiveUserId.startsWith("fsn-tv-")) {
    try {
      const devRow = db.prepare("SELECT user_id FROM devices WHERE device_id = ?").get(effectiveUserId);
      if (devRow?.user_id) effectiveUserId = devRow.user_id;
    } catch (_) {}
  }

  let rows = [];
  if (effectiveUserId) {
    // When a family account is specified (or resolved from the device), load all stories belonging to that family account.
    // Also include any legacy stories on this device that have no user_id assigned yet (user_id IS NULL).
    // NEVER load stories that belong to another family account (user_id != effectiveUserId)!
    const stmt = db.prepare(`
      SELECT * FROM stories
      WHERE user_id = ? OR (user_id IS NULL AND device_id = ?)
      ORDER BY updated_at DESC, rowid DESC
      LIMIT ?
    `);
    rows = stmt.all(effectiveUserId, normalizedDev || "", limit);
  } else if (normalizedDev) {
    const stmt = db.prepare(`
      SELECT * FROM stories
      WHERE device_id = ?
      ORDER BY updated_at DESC, rowid DESC
      LIMIT ?
    `);
    rows = stmt.all(normalizedDev, limit);
  }

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

export function getStoryById(id, deviceId, userId = null) {
  if (!id || (!deviceId && !userId)) return null;

  const normalizedDev = (deviceId || "").trim();
  const normalizedUser = (userId || "").trim();

  let effectiveUserId = normalizedUser || null;
  let devRegisteredUserId = null;
  if (normalizedDev) {
    try {
      const devRow = db.prepare("SELECT user_id FROM devices WHERE device_id = ?").get(normalizedDev);
      if (devRow?.user_id) devRegisteredUserId = devRow.user_id;
    } catch (_) {}
  }
  const isDefaultGeneratedUser = normalizedDev && effectiveUserId === "family-" + normalizedDev.replace(/^fsn-tv-/, "");
  if ((!effectiveUserId || isDefaultGeneratedUser) && devRegisteredUserId) {
    effectiveUserId = devRegisteredUserId;
  }
  if (effectiveUserId && effectiveUserId.startsWith("fsn-tv-")) {
    try {
      const devRow = db.prepare("SELECT user_id FROM devices WHERE device_id = ?").get(effectiveUserId);
      if (devRow?.user_id) effectiveUserId = devRow.user_id;
    } catch (_) {}
  }

  let row = null;
  if (effectiveUserId) {
    const stmt = db.prepare(`
      SELECT * FROM stories
      WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND device_id = ?))
    `);
    row = stmt.get(id, effectiveUserId, normalizedDev || "");
  } else if (normalizedDev) {
    const stmt = db.prepare(`SELECT * FROM stories WHERE id = ? AND device_id = ?`);
    row = stmt.get(id, normalizedDev);
  }
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

export function saveStory(deviceId, story = {}, userId = null) {
  if (!deviceId) throw new Error("deviceId is required");
  if (!story.id) throw new Error("story.id is required");

  const effectiveUserId = story.userId || userId || getDevice(deviceId)?.user_id || null;
  upsertDevice(deviceId, effectiveUserId);

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
      user_id = COALESCE(excluded.user_id, stories.user_id),
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
    effectiveUserId,
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
 * Supports chapter-specific illustration saving into chapters_json when chapter > 1.
 */
export function saveStoryIllustration(storyId, pageIndex, illustrationUrl, alt = "", chapter = 1) {
  if (!storyId || pageIndex === undefined || pageIndex === null || !illustrationUrl) return null;
  const row = db.prepare("SELECT * FROM stories WHERE id = ?").get(storyId);
  if (!row) return null;

  const chNum = Number(chapter) || 1;
  const now = new Date().toISOString();

  if (chNum > 1) {
    let chapters = [];
    try {
      chapters = row.chapters_json ? JSON.parse(row.chapters_json) : [];
    } catch {
      chapters = [];
    }

    let chapterIndex = chapters.findIndex((c) => c.chapter === chNum);
    if (chapterIndex === -1 && chapters[chNum - 1]) {
      chapterIndex = chNum - 1;
    }

    if (chapterIndex !== -1 && chapters[chapterIndex]) {
      const targetChapter = { ...chapters[chapterIndex] };
      const illustrations = Array.isArray(targetChapter.illustrations) ? [...targetChapter.illustrations] : [];
      illustrations[pageIndex] = illustrationUrl;
      targetChapter.illustrations = illustrations;

      if (Array.isArray(targetChapter.pages) && targetChapter.pages[pageIndex]) {
        const rawPage = targetChapter.pages[pageIndex];
        const text = typeof rawPage === "object" ? rawPage.text : rawPage;
        const scene = typeof rawPage === "object" ? rawPage.scene : undefined;
        targetChapter.pages[pageIndex] = {
          text,
          scene,
          illustration: { url: illustrationUrl, alt: alt || `Illustration for page ${pageIndex + 1}` },
        };
      }

      chapters[chapterIndex] = targetChapter;
      db.prepare(`
        UPDATE stories
        SET chapters_json = ?, updated_at = ?
        WHERE id = ?
      `).run(JSON.stringify(chapters), now, storyId);

      return getStoryById(storyId, row.device_id);
    }
  }

  // Chapter 1 / Root fallback
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

  db.prepare(`
    UPDATE stories
    SET illustrations_json = ?, pages_json = ?, updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(illustrations), JSON.stringify(pages), now, storyId);

  return getStoryById(storyId, row.device_id);
}

/**
 * Retrieves a cached illustration for a story page from SQLite if available.
 * Checks chapters_json when chapter > 1 to avoid cross-chapter illustration collisions.
 */
export function getStoryIllustration(storyId, pageIndex, chapter = 1) {
  if (!storyId || pageIndex === undefined || pageIndex === null) return null;
  const row = db.prepare("SELECT illustrations_json, chapters_json FROM stories WHERE id = ?").get(storyId);
  if (!row) return null;

  const chNum = Number(chapter) || 1;
  if (chNum > 1 && row.chapters_json) {
    try {
      const chapters = JSON.parse(row.chapters_json);
      const targetChapter = chapters.find((c) => c.chapter === chNum) || chapters[chNum - 1];
      if (targetChapter && Array.isArray(targetChapter.illustrations)) {
        return targetChapter.illustrations[pageIndex] || null;
      }
    } catch {
      // Fall through if chapter parsing fails
    }
  }

  if (chNum === 1 && row.illustrations_json) {
    try {
      const illustrations = JSON.parse(row.illustrations_json);
      return illustrations[pageIndex] || null;
    } catch {
      return null;
    }
  }

  return null;
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
export function saveNarration({ storyId = null, deviceId = null, pageIndex = null, chapter = 1, voiceId, textHash, audioData, speechMarks = [] }) {
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
        const chNum = Number(chapter) || 1;
        const chKey = `ch${chNum}_${pageIndex}`;
        existingNarrations[chKey] = {
          audio: audioData,
          speechMarks,
          voiceId,
        };
        if (chNum === 1) {
          existingNarrations[pageIndex] = {
            audio: audioData,
            speechMarks,
            voiceId,
          };
        }
        const updateStmt = db.prepare(`UPDATE stories SET narrations_json = ?, updated_at = ? WHERE id = ? AND device_id = ?`);
        updateStmt.run(JSON.stringify(existingNarrations), now, storyId, deviceId);
      }
    } catch (e) {
      console.warn("[db] Could not update story narrations_json:", e.message);
    }
  }

  return getNarration(textHash, voiceId);
}

