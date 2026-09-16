import {
  trackEvent,
  loadEvents,
  clearEvents,
  summarize,
  ANALYTICS_STORAGE_KEY,
} from "../utils/analytics";
import { StorageService } from "../utils/storage";

describe("analytics utility (Task 18.2)", () => {
  beforeEach(() => {
    StorageService.removeItem(ANALYTICS_STORAGE_KEY);
  });

  afterEach(() => {
    StorageService.removeItem(ANALYTICS_STORAGE_KEY);
  });

  it("trackEvent appends new events correctly", () => {
    expect(loadEvents()).toEqual([]);
    trackEvent("test_event", { foo: "bar" });
    const events = loadEvents();
    expect(events.length).toBe(1);
    expect(events[0].type).toBe("test_event");
    expect(events[0].data).toEqual({ foo: "bar" });
    expect(events[0].timestamp).toBeDefined();

    trackEvent("second_event", { num: 42 });
    const events2 = loadEvents();
    expect(events2.length).toBe(2);
    expect(events2[1].type).toBe("second_event");
  });

  it("clearEvents removes all analytics data", () => {
    trackEvent("story_generated", { theme: "space" });
    expect(loadEvents().length).toBe(1);
    clearEvents();
    expect(loadEvents()).toEqual([]);
  });

  it("summarize returns safe defaults when there are no events", () => {
    const summary = summarize();
    expect(summary.totalStories).toBe(0);
    expect(summary.mostPopularTheme).toBe("None");
    expect(summary.avgCompletionRate).toBe(0);
    expect(summary.topFamilyMembers).toEqual([]);
    expect(summary.favoriteVoice).toBe("None");
  });

  it("summarize returns correct metrics given a set of events", () => {
    trackEvent("story_generated", {
      theme: "a cozy adventure",
      familyMembers: ["Maya", "Dad"],
      voice: "Matthew",
    });
    trackEvent("story_generated", {
      theme: "a trip to outer space",
      familyMembers: ["Maya", "Biscuit"],
      voice: "Joanna",
    });
    trackEvent("story_generated", {
      theme: "a cozy adventure",
      familyMembers: ["Maya", "Mom", "Dad"],
      voice: "Joanna",
    });

    trackEvent("story_completed", { totalPages: 6 });
    trackEvent("story_completed", { totalPages: 6 });

    const summary = summarize();
    expect(summary.totalStories).toBe(3);
    expect(summary.mostPopularTheme).toBe("a cozy adventure");
    expect(summary.avgCompletionRate).toBe(67); // 2 out of 3 = 67%
    expect(summary.favoriteVoice).toBe("Joanna");
    expect(summary.topFamilyMembers[0]).toBe("Maya");
    expect(summary.topFamilyMembers).toContain("Dad");
  });
});
