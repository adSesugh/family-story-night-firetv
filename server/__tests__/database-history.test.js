import { describe, it, expect, beforeEach } from "vitest";
import {
  db,
  saveStory,
  getStories,
  getStoryById,
  deleteStory,
  toggleFavorite,
  savePreferences,
  getPreferences,
} from "../db.js";

describe("SQLite Flat DB: Story History, Illustrations & Preferences", () => {
  const testDeviceA = "test-firetv-device-a-" + Date.now();
  const testDeviceB = "test-firetv-device-b-" + Date.now();

  beforeEach(() => {
    // Clean up test data for these devices
    db.prepare(`DELETE FROM stories WHERE device_id IN (?, ?)`).run(testDeviceA, testDeviceB);
    db.prepare(`DELETE FROM preferences WHERE device_id IN (?, ?)`).run(testDeviceA, testDeviceB);
    db.prepare(`DELETE FROM devices WHERE device_id IN (?, ?)`).run(testDeviceA, testDeviceB);
  });

  describe("Device Preferences", () => {
    it("saves and retrieves preferences for a specific deviceId", () => {
      const saved = savePreferences(testDeviceA, {
        voiceId: "Matthew",
        storyLength: 9,
        themeIndex: 2,
        storyCategory: "science",
        illustrationStyle: "storybook",
        pinHash: "9876",
        parentSettings: { strictThemes: true },
      });

      expect(saved.deviceId).toBe(testDeviceA);
      expect(saved.voiceId).toBe("Matthew");
      expect(saved.storyLength).toBe(9);
      expect(saved.illustrationStyle).toBe("storybook");
      expect(saved.pinHash).toBe("9876");
      expect(saved.parentSettings.strictThemes).toBe(true);

      const retrieved = getPreferences(testDeviceA);
      expect(retrieved.voiceId).toBe("Matthew");
      expect(retrieved.storyLength).toBe(9);
    });

    it("returns null for non-existent device preferences", () => {
      const prefs = getPreferences("non-existent-device-12345");
      expect(prefs).toBeNull();
    });
  });

  describe("Stories & Illustrations Persistence", () => {
    const mockStory = {
      id: "story-uuid-101",
      familyMembers: ["Leo", "Maya"],
      theme: "Enchanted Starlit Forest",
      category: "nature",
      chapter: 1,
      lesson: "Patience and gentle steps reveal the brightest paths.",
      choices: ["Explore the crystal cave", "Camp by the glowing pond"],
      firstPage: "Leo and Maya stepped under the emerald branches.",
      pages: [
        { text: "Leo and Maya stepped under the emerald branches.", scene: "Children walking under canopy" },
        { text: "A gentle glowing rabbit offered to lead the way.", scene: "Silver rabbit glowing softly" },
      ],
      illustrations: [
        { url: "data:image/webp;base64,mockBase64IllustrationPage1...", alt: "Scene 1" },
        { url: "data:image/webp;base64,mockBase64IllustrationPage2...", alt: "Scene 2" },
      ],
      chapters: [
        {
          chapter: 1,
          pages: [
            { text: "Leo and Maya stepped under the emerald branches.", scene: "Children walking under canopy" },
          ],
          illustrations: [
            { url: "data:image/webp;base64,mockBase64IllustrationPage1...", alt: "Scene 1" },
          ],
          lesson: "Patience and gentle steps reveal the brightest paths.",
          choices: ["Explore the crystal cave", "Camp by the glowing pond"],
        },
      ],
    };

    it("saves a story with full illustrations directly into SQLite", () => {
      const saved = saveStory(testDeviceA, mockStory);
      expect(saved).toBeDefined();
      expect(saved.id).toBe(mockStory.id);
      expect(saved.deviceId).toBe(testDeviceA);
      expect(saved.illustrations).toHaveLength(2);
      expect(saved.illustrations[0].url).toContain("mockBase64IllustrationPage1");
      expect(saved.pages).toHaveLength(2);
      expect(saved.choices).toHaveLength(2);
      expect(saved.isFavorite).toBe(false);
    });

    it("retrieves saved stories in updated_at DESC order", () => {
      saveStory(testDeviceA, mockStory);

      const mockStory2 = {
        ...mockStory,
        id: "story-uuid-102",
        theme: "Space Journey to the Moon",
        firstPage: "The rocket ship hummed quietly in the twilight.",
      };
      saveStory(testDeviceA, mockStory2);

      const stories = getStories(testDeviceA);
      expect(stories).toHaveLength(2);
      expect(stories[0].id).toBe("story-uuid-102"); // Most recent first
      expect(stories[1].id).toBe("story-uuid-101");
    });

    it("isolates stories per deviceId", () => {
      saveStory(testDeviceA, mockStory);

      const storiesForDeviceB = getStories(testDeviceB);
      expect(storiesForDeviceB).toHaveLength(0);

      const storyFromDeviceA = getStoryById(mockStory.id, testDeviceB);
      expect(storyFromDeviceA).toBeNull();
    });

    it("updates chapter continuation without losing original illustrations", () => {
      saveStory(testDeviceA, mockStory);

      // Add Chapter 2
      const updatedStory = {
        ...mockStory,
        chapter: 2,
        lesson: "Courage shines brightest in the dark.",
        choices: ["Cross the rainbow bridge", "Follow the starlight echo"],
        illustrations: [
          ...mockStory.illustrations,
          { url: "data:image/webp;base64,mockBase64IllustrationPage3Chapter2...", alt: "Scene 3" },
        ],
      };

      const result = saveStory(testDeviceA, updatedStory);
      expect(result.chapter).toBe(2);
      expect(result.illustrations).toHaveLength(3);
      expect(result.illustrations[2].url).toContain("mockBase64IllustrationPage3Chapter2");
    });

    it("preserves existing illustrations when client syncs with empty illustrations (localStorage quota guard)", () => {
      const storyWithPageIllustrations = {
        ...mockStory,
        id: "story-with-page-ill",
        pages: [
          { text: "Page 1 text", scene: "Scene 1", illustration: { url: "data:image/webp;base64,mockBase64IllustrationPage1..." } },
          { text: "Page 2 text", scene: "Scene 2", illustration: { url: "data:image/webp;base64,mockBase64IllustrationPage2..." } },
        ],
      };
      saveStory(testDeviceA, storyWithPageIllustrations);

      // Simulate client syncing narrations with empty illustrations array and pages without illustration property
      const strippedStory = {
        ...storyWithPageIllustrations,
        illustrations: [],
        pages: [
          { text: "Page 1 text", scene: "Scene 1" },
          { text: "Page 2 text", scene: "Scene 2" },
        ],
      };

      const result = saveStory(testDeviceA, strippedStory);
      expect(result.illustrations).toHaveLength(2);
      expect(result.pages[0].illustration).toBeDefined();
      expect(result.pages[0].illustration.url).toBe("data:image/webp;base64,mockBase64IllustrationPage1...");
    });

    it("saves and retrieves story illustrations directly via saveStoryIllustration", async () => {
      const { saveStoryIllustration, getStoryIllustration } = await import("../db.js");
      saveStory(testDeviceA, mockStory);

      saveStoryIllustration(mockStory.id, 1, "data:image/png;base64,newPage2Illustration...", "Page 2 alt");
      const cached = getStoryIllustration(mockStory.id, 1);
      expect(cached).toBe("data:image/png;base64,newPage2Illustration...");

      const updated = getStoryById(mockStory.id, testDeviceA);
      expect(updated.illustrations[1]).toBe("data:image/png;base64,newPage2Illustration...");
      expect(updated.pages[1].illustration.url).toBe("data:image/png;base64,newPage2Illustration...");
    });

    it("toggles favorite status in the database", () => {
      saveStory(testDeviceA, mockStory);

      const favorited = toggleFavorite(mockStory.id, testDeviceA);
      expect(favorited.isFavorite).toBe(true);

      const unfavorited = toggleFavorite(mockStory.id, testDeviceA);
      expect(unfavorited.isFavorite).toBe(false);
    });

    it("deletes a story by id and deviceId", () => {
      saveStory(testDeviceA, mockStory);
      expect(getStoryById(mockStory.id, testDeviceA)).not.toBeNull();

      const deleted = deleteStory(mockStory.id, testDeviceA);
      expect(deleted).toBe(true);
      expect(getStoryById(mockStory.id, testDeviceA)).toBeNull();
    });
  });

  describe("HTTP Controllers for History & Preferences", () => {
    const createMockRes = () => {
      const res = {
        statusCode: 200,
        body: null,
        status(code) {
          res.statusCode = code;
          return res;
        },
        json(data) {
          res.body = data;
          return res;
        },
      };
      return res;
    };

    it("handles saveStoryHandler and getHistoryHandler over HTTP endpoints", async () => {
      const { saveStoryHandler, getHistoryHandler, toggleFavoriteHandler, deleteStoryHandler } = await import(
        "../controllers/historyController.js"
      );

      const saveReq = {
        body: {
          deviceId: testDeviceA,
          story: {
            id: "http-story-1",
            theme: "Moonlit Ocean Voyage",
            firstPage: "Waves lapped gently against the sides of the boat.",
            pages: [{ text: "Waves lapped gently." }],
            illustrations: [{ url: "data:image/webp;base64,oceanIllustration..." }],
          },
        },
      };
      const saveRes = createMockRes();
      saveStoryHandler(saveReq, saveRes);

      expect(saveRes.statusCode).toBe(200);
      expect(saveRes.body.success).toBe(true);
      expect(saveRes.body.story.illustrations).toHaveLength(1);

      const getReq = { query: { deviceId: testDeviceA } };
      const getRes = createMockRes();
      getHistoryHandler(getReq, getRes);

      expect(getRes.statusCode).toBe(200);
      expect(getRes.body.stories).toHaveLength(1);
      expect(getRes.body.stories[0].theme).toBe("Moonlit Ocean Voyage");

      const favReq = { query: { deviceId: testDeviceA }, params: { id: "http-story-1" } };
      const favRes = createMockRes();
      toggleFavoriteHandler(favReq, favRes);
      expect(favRes.body.isFavorite).toBe(true);

      const delReq = { query: { deviceId: testDeviceA }, params: { id: "http-story-1" } };
      const delRes = createMockRes();
      deleteStoryHandler(delReq, delRes);
      expect(delRes.body.success).toBe(true);
    });

    it("handles savePreferencesHandler and getPreferencesHandler over HTTP endpoints", async () => {
      const { savePreferencesHandler, getPreferencesHandler } = await import(
        "../controllers/preferencesController.js"
      );

      const saveReq = {
        body: {
          deviceId: testDeviceA,
          preferences: {
            voiceId: "Emma",
            storyLength: 3,
            illustrationStyle: "claymation",
          },
        },
      };
      const saveRes = createMockRes();
      savePreferencesHandler(saveReq, saveRes);

      expect(saveRes.statusCode).toBe(200);
      expect(saveRes.body.preferences.voiceId).toBe("Emma");
      expect(saveRes.body.preferences.storyLength).toBe(3);

      const getReq = { query: { deviceId: testDeviceA } };
      const getRes = createMockRes();
      getPreferencesHandler(getReq, getRes);

      expect(getRes.statusCode).toBe(200);
      expect(getRes.body.preferences.voiceId).toBe("Emma");
    });
  });
});

