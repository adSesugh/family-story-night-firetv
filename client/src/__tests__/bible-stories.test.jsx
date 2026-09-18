import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock Swiper to avoid ESM issues in Jest
jest.mock("swiper/react", () => ({
  Swiper: ({ children }) => <div data-testid="swiper-mock">{children}</div>,
  SwiperSlide: ({ children }) => <div data-testid="swiper-slide-mock">{children}</div>,
}));
jest.mock("swiper/modules", () => ({
  Navigation: {},
}));
jest.mock("swiper/css", () => ({}));
jest.mock("swiper/css/navigation", () => ({}));

import App from "../App";
import SetupScreen from "../components/SetupScreen";
import { THEME_CATEGORIES } from "../constants/themes";

describe("Bible Stories Integration & Category Selection", () => {
  describe("SetupScreen Category Switcher", () => {
    it("renders collection tabs for Adventures and Bible Stories", () => {
      render(
        <SetupScreen
          names=""
          setNames={jest.fn()}
          themeIndex={0}
          setThemeIndex={jest.fn()}
          category="adventures"
          setCategory={jest.fn()}
          categories={THEME_CATEGORIES}
          themes={THEME_CATEGORIES[0].themes}
          onSubmit={jest.fn()}
        />
      );

      const adventuresTab = screen.getByTestId("category-tab-adventures");
      const bibleTab = screen.getByTestId("category-tab-bible");

      expect(adventuresTab).toBeInTheDocument();
      expect(bibleTab).toBeInTheDocument();
      expect(adventuresTab).toHaveAttribute("aria-selected", "true");
      expect(bibleTab).toHaveAttribute("aria-selected", "false");
    });

    it("clicking Bible Stories tab invokes setCategory('bible') and resets themeIndex", () => {
      const setCategoryMock = jest.fn();
      const setThemeIndexMock = jest.fn();

      render(
        <SetupScreen
          names=""
          setNames={jest.fn()}
          themeIndex={2}
          setThemeIndex={setThemeIndexMock}
          category="adventures"
          setCategory={setCategoryMock}
          categories={THEME_CATEGORIES}
          themes={THEME_CATEGORIES[0].themes}
          onSubmit={jest.fn()}
        />
      );

      fireEvent.click(screen.getByTestId("category-tab-bible"));

      expect(setCategoryMock).toHaveBeenCalledWith("bible");
      expect(setThemeIndexMock).toHaveBeenCalledWith(0);
    });

    it("displays Bible story themes when category is 'bible'", () => {
      const bibleThemes = THEME_CATEGORIES.find((c) => c.id === "bible").themes;

      render(
        <SetupScreen
          names=""
          setNames={jest.fn()}
          themeIndex={0}
          setThemeIndex={jest.fn()}
          category="bible"
          setCategory={jest.fn()}
          categories={THEME_CATEGORIES}
          themes={bibleThemes}
          onSubmit={jest.fn()}
        />
      );

      expect(screen.getByText(bibleThemes[0])).toBeInTheDocument();
    });
  });

  describe("App Full Flow with Bible Stories", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      localStorage.clear();
    });

    afterEach(() => {
      global.fetch = originalFetch;
      jest.restoreAllMocks();
    });

    it("generates a Bible story with category: 'bible' and passes to backend", async () => {
      let generateStoryBody = null;

      global.fetch = jest.fn(async (url, opt) => {
        const urlStr = String(url);
        if (urlStr.includes("/generate-story")) {
          generateStoryBody = JSON.parse(opt.body);
          return {
            ok: true,
            json: async () => ({
              pages: [
                "Noah and his family built a great wooden ark under the warm sun.",
                "Maya and Dad helped guide two gentle rabbits into their cozy pen.",
                "When the rains passed, a radiant rainbow stretched across the sky.",
              ],
              lesson: "Faith and patience bring hope after every storm.",
              choices: [
                "Look for the gentle dove returning with an olive leaf",
                "Plant a sweet garden of figs and grapes under the rainbow",
              ],
              chapter: 1,
            }),
          };
        }
        if (urlStr.includes("/illustrate")) {
          return {
            ok: true,
            blob: async () => new Blob(["fake-img"], { type: "image/png" }),
          };
        }
        if (urlStr.includes("/narrate")) {
          return {
            ok: true,
            blob: async () => new Blob(["fake-audio"], { type: "audio/mpeg" }),
          };
        }
        return { ok: false };
      });

      render(<App />);

      // Switch to Bible Stories category
      const bibleTab = screen.getByTestId("category-tab-bible");
      fireEvent.click(bibleTab);

      // Verify theme switched to Bible preset
      expect(screen.getByText(/Noah's Ark/i)).toBeInTheDocument();

      // Enter names and begin story
      const input = screen.getByPlaceholderText("Maya, Dad, Biscuit the dog");
      fireEvent.change(input, { target: { value: "Maya, Dad" } });
      fireEvent.click(screen.getByRole("button", { name: "Begin the story" }));

      // Wait for story screen to load
      await waitFor(() => {
        expect(screen.getByTestId("story-screen")).toBeInTheDocument();
      });

      // Verify payload sent to /generate-story
      expect(generateStoryBody).not.toBeNull();
      expect(generateStoryBody.category).toBe("bible");
      expect(generateStoryBody.theme).toContain("Noah's Ark");
      expect(generateStoryBody.familyMembers).toEqual(["Maya", "Dad"]);
    });

    it("switches categories using remote ArrowLeft and ArrowRight on setup screen", () => {
      render(<App />);

      // Initially in adventures
      expect(screen.getByTestId("category-tab-adventures")).toHaveAttribute("aria-selected", "true");

      // Press ArrowRight to switch to Bible stories
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(screen.getByTestId("category-tab-bible")).toHaveAttribute("aria-selected", "true");
      expect(screen.getByText(/Noah's Ark/i)).toBeInTheDocument();

      // Press ArrowLeft to switch back to Adventures
      fireEvent.keyDown(window, { key: "ArrowLeft" });
      expect(screen.getByTestId("category-tab-adventures")).toHaveAttribute("aria-selected", "true");
      expect(screen.getByText(/a cozy adventure/i)).toBeInTheDocument();
    });
  });
});
