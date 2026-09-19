import { describe, it, expect } from "vitest";
import { CANONICAL_BIBLE_STORIES, THEME_CATEGORIES, DEFAULT_CATEGORY_ID } from "../constants/themes.js";
import { VOICES, DEFAULT_VOICE } from "../constants/voices.js";

describe("Server Themes & Voices Endpoints", () => {
  it("exports valid theme categories and canonical Bible stories", () => {
    expect(Array.isArray(THEME_CATEGORIES)).toBe(true);
    expect(THEME_CATEGORIES.length).toBeGreaterThanOrEqual(6);

    const adventures = THEME_CATEGORIES.find((c) => c.id === "adventures");
    const bible = THEME_CATEGORIES.find((c) => c.id === "bible");

    expect(adventures).toBeDefined();
    expect(adventures.themes.length).toBeGreaterThan(0);

    expect(bible).toBeDefined();
    expect(bible.themes.length).toBe(CANONICAL_BIBLE_STORIES.length);

    expect(DEFAULT_CATEGORY_ID).toBe("adventures");
  });

  it("exports standard narrator voices with required metadata", () => {
    expect(Array.isArray(VOICES)).toBe(true);
    expect(VOICES.length).toBe(4);

    const joanna = VOICES.find((v) => v.id === "Joanna");
    const matthew = VOICES.find((v) => v.id === "Matthew");

    expect(joanna).toBeDefined();
    expect(joanna.tagline).toBe("Warm & Gentle");
    expect(joanna.previewSnippet).toBeDefined();

    expect(matthew).toBeDefined();
    expect(matthew.pitch).toBe("Deep baritone");

    expect(DEFAULT_VOICE).toBe("Joanna");
  });
});
