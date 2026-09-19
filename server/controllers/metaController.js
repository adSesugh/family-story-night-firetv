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

export const getHealth = (_req, res) => res.json({ status: "ok" });
