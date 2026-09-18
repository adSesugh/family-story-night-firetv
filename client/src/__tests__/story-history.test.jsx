/**
 * Task 13.3 — Unit tests for storyHistory.js utility
 * Requirements: 1.5, 1.6, 5.1, 5.4
 */

import { saveStory, loadHistory, deleteStory, clearHistory } from "../utils/storyHistory";

// ─── localStorage mock ───────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] ?? null),
    setItem: jest.fn((key, value) => { store[key] = value; }),
    removeItem: jest.fn((key) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    _reset() { store = {}; jest.clearAllMocks(); },
    _store() { return store; },
  };
})();

Object.defineProperty(global, "localStorage", { value: localStorageMock, writable: true });

// crypto.randomUUID is available in Node 19+ / jsdom; polyfill if not
if (!global.crypto) {
  global.crypto = { randomUUID: () => Math.random().toString(36).slice(2) };
} else if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = () => Math.random().toString(36).slice(2);
}

// ─── Helper ──────────────────────────────────────────────────────────────────
function makeStory(overrides = {}) {
  return {
    familyMembers: ["Maya", "Dad"],
    theme: "a cozy adventure",
    pages: ["Once upon a time…", "The end."],
    firstPage: "Once upon a time…",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────
beforeEach(() => {
  localStorageMock._reset();
});

describe("loadHistory()", () => {
  it("returns [] when storage is empty", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("returns [] when stored data is corrupted JSON", () => {
    // Manually write bad JSON to storage
    localStorageMock.setItem("familyStoryNight_history", "NOT_JSON{{{");
    // StorageService.getItem calls JSON.parse internally — returns null on error
    expect(loadHistory()).toEqual([]);
  });

  it("returns [] when stored data is valid JSON but has no stories array", () => {
    localStorageMock.setItem(
      "familyStoryNight_history",
      JSON.stringify({ version: 1 })
    );
    expect(loadHistory()).toEqual([]);
  });
});

describe("saveStory()", () => {
  it("saves a story and loadHistory returns it", () => {
    saveStory(makeStory());
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0].theme).toBe("a cozy adventure");
  });

  it("assigns a unique id to each saved story", () => {
    saveStory(makeStory());
    saveStory(makeStory());
    const history = loadHistory();
    expect(history[0].id).toBeTruthy();
    expect(history[1].id).toBeTruthy();
    expect(history[0].id).not.toBe(history[1].id);
  });

  it("sets generatedAt to an ISO date string", () => {
    saveStory(makeStory());
    const [story] = loadHistory();
    expect(() => new Date(story.generatedAt)).not.toThrow();
    expect(new Date(story.generatedAt).toISOString()).toBe(story.generatedAt);
  });

  it("enforces the 50-story cap by dropping the oldest entry (Req 1.6)", () => {
    // Fill up to 50 stories
    for (let i = 0; i < 50; i++) {
      saveStory(makeStory({ theme: `theme-${i}` }));
    }
    expect(loadHistory()).toHaveLength(50);

    // Adding one more should drop theme-0 and keep 50
    saveStory(makeStory({ theme: "theme-new" }));
    const history = loadHistory();
    expect(history).toHaveLength(50);
    expect(history[0].theme).toBe("theme-1"); // oldest remaining
    expect(history[49].theme).toBe("theme-new"); // newest
  });

  it("accepts pages with illustration objects (Req 5.1)", () => {
    const pages = [
      { text: "Once upon a time…", illustration: { url: "https://img.example/1.png", alt: "Scene 1" } },
      { text: "The end.", illustration: null },
    ];
    saveStory(makeStory({ pages }));
    const [story] = loadHistory();
    expect(story.pages[0].illustration.url).toBe("https://img.example/1.png");
    expect(story.pages[1].illustration).toBeNull();
  });
});

describe("deleteStory()", () => {
  it("removes only the story with the matching id", () => {
    saveStory(makeStory({ theme: "theme-A" }));
    saveStory(makeStory({ theme: "theme-B" }));
    const [a] = loadHistory();

    deleteStory(a.id);

    const remaining = loadHistory();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].theme).toBe("theme-B");
  });

  it("leaves history unchanged when id does not exist", () => {
    saveStory(makeStory());
    deleteStory("non-existent-id");
    expect(loadHistory()).toHaveLength(1);
  });
});

describe("Bible Story Category Tagging in History", () => {
  it("automatically tags biblical themes with category: 'bible'", () => {
    saveStory(makeStory({ theme: "Noah's Ark and the rainbow of hope" }));
    const [story] = loadHistory();
    expect(story.category).toBe("bible");
  });

  it("retains category: 'bible' when explicitly provided", () => {
    saveStory(makeStory({ category: "bible", theme: "A peaceful bedtime" }));
    const [story] = loadHistory();
    expect(story.category).toBe("bible");
  });
});

describe("Storage Quota Resilience", () => {
  it("safely saves stories even when full base64 images exceed quota", () => {
    // Simulate setItem failing once due to size, then succeeding when lightened
    let callCount = 0;
    const originalSetItem = localStorageMock.setItem;
    localStorageMock.setItem = jest.fn((key, value) => {
      callCount++;
      if (callCount === 1) {
        throw new Error("QuotaExceededError");
      }
      return originalSetItem(key, value);
    });

    const heavyImageStory = makeStory({
      theme: "David and Goliath: faith over fear",
      illustrations: ["data:image/png;base64,very_heavy_image_data_here"],
    });

    const saved = saveStory(heavyImageStory);
    expect(saved).toBeTruthy();
    expect(saved.theme).toBe("David and Goliath: faith over fear");
    expect(saved.category).toBe("bible");

    localStorageMock.setItem = originalSetItem;
  });
});
