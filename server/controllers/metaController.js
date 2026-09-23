import { THEME_CATEGORIES, DEFAULT_CATEGORY_ID, CANONICAL_BIBLE_STORIES } from "../constants/themes.js";
import { VOICES, DEFAULT_VOICE } from "../constants/voices.js";

export const getThemes = (_req, res) => {
  res.json({
    categories: THEME_CATEGORIES,
    defaultCategoryId: DEFAULT_CATEGORY_ID,
    canonicalBibleStories: CANONICAL_BIBLE_STORIES,
  });
};

export const getVoices = (_req, res) => {
  res.json({
    voices: VOICES,
    defaultVoice: DEFAULT_VOICE,
  });
};

import { db } from "../db.js";

export const getHealth = (_req, res) => {
  try {
    const counts = {
      devices: db.prepare("SELECT COUNT(*) as c FROM devices").get()?.c || 0,
      stories: db.prepare("SELECT COUNT(*) as c FROM stories").get()?.c || 0,
      preferences: db.prepare("SELECT COUNT(*) as c FROM preferences").get()?.c || 0,
    };
    res.json({ status: "ok", database: { status: "connected", counts } });
  } catch (err) {
    res.json({ status: "ok", database: { status: "error", message: err.message } });
  }
};
