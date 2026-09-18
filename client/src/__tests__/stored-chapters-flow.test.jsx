import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock StoryScreen to isolate App's chapter navigation logic and avoid Swiper ESM issues in Jest
jest.mock("../components/StoryScreen", () => ({
  pages,
  pageIndex,
  onTurn,
  choices,
  onSelectChoice,
  chapter,
  nextStoredChapterNumber,
  onContinueNextStoredChapter,
  onReturnHome,
}) => (
  <div data-testid="story-screen">
    <div data-testid="current-chapter">Chapter {chapter}</div>
    <div data-testid="page-text">
      {typeof pages[pageIndex] === "object" ? pages[pageIndex].text : pages[pageIndex]}
    </div>
    <button data-testid="turn-next-btn" onClick={() => onTurn(pageIndex + 1)}>
      Turn Page
    </button>
    {nextStoredChapterNumber ? (
      <button
        data-testid="continue-next-stored-chapter-btn"
        onClick={onContinueNextStoredChapter}
      >
        Continue to Chapter {nextStoredChapterNumber}
      </button>
    ) : (
      choices &&
      choices.map((c, idx) => (
        <button
          key={idx}
          data-testid={`choice-${idx}`}
          onClick={() => onSelectChoice(c)}
        >
          {c}
        </button>
      ))
    )}
    <button data-testid="return-home-btn" onClick={onReturnHome}>
      Return Home
    </button>
  </div>
));

import App from "../App";
import * as storyHistory from "../utils/storyHistory";
import * as storage from "../utils/storage";

// Mock fetch
global.fetch = jest.fn();

// Mock Audio
window.Audio = jest.fn().mockImplementation(() => ({
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  load: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

describe("Stored Chapters Navigation Flow", () => {
  const sampleMultiChapterStory = {
    id: "test-multi-ch-123",
    theme: "Enchanted Forest Adventure",
    familyMembers: ["Maya", "Leo"],
    category: "adventures",
    generatedAt: new Date().toISOString(),
    chapter: 2,
    chapters: [
      {
        chapter: 1,
        pages: [
          { text: "Chapter 1: The mysterious glowing tree in the forest." },
          { text: "Chapter 1: Maya and Leo found a glowing key under the moss." },
        ],
        illustrations: ["data:image/png;base64,ch1_illus1"],
        lesson: "Always stay curious and kind.",
        choices: ["Climb the tree", "Open the stone door"],
      },
      {
        chapter: 2,
        pages: [
          { text: "Chapter 2: The stone door revealed a hidden underground cavern." },
          { text: "Chapter 2: Inside, crystal lanterns lit their path." },
        ],
        illustrations: ["data:image/png;base64,ch2_illus1"],
        lesson: "Courage shines brightest in the dark.",
        choices: ["Cross the crystal bridge", "Follow the subterranean river"],
      },
    ],
    pages: [
      { text: "Chapter 2: The stone door revealed a hidden underground cavern." },
      { text: "Chapter 2: Inside, crystal lanterns lit their path." },
    ],
    illustrations: ["data:image/png;base64,ch2_illus1"],
    firstPage: "Chapter 1: The mysterious glowing tree in the forest.",
    lesson: "Courage shines brightest in the dark.",
    choices: ["Cross the crystal bridge", "Follow the subterranean river"],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.spyOn(storage.StorageService, "getItem").mockReturnValue(null);
    jest.spyOn(storage.StorageService, "setItem").mockReturnValue(true);

    fetch.mockImplementation((url) => {
      if (url.includes("/narrate")) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(["audio"], { type: "audio/mpeg" })),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("loads Chapter 1 when reopening a multi-chapter story and offers Next Chapter without network request", async () => {
    jest.spyOn(storyHistory, "loadHistory").mockReturnValue([sampleMultiChapterStory]);

    render(<App />);

    // Open Story History
    const historyBtn = screen.getByRole("button", { name: /View History/i });
    fireEvent.click(historyBtn);

    // Verify history card shows Ch. 1–2
    expect(screen.getByText(/Ch\. 1–2/i)).toBeInTheDocument();
    expect(screen.getByText(/Read from Ch\. 1 \(2 Chapters\)/i)).toBeInTheDocument();

    // Select the story
    const storyCard = screen.getByTestId("history-card-test-multi-ch-123");
    fireEvent.click(storyCard);

    // Chapter 1 is active initially
    expect(screen.getByTestId("current-chapter")).toHaveTextContent("Chapter 1");
    expect(screen.getByTestId("page-text")).toHaveTextContent("Chapter 1: The mysterious glowing tree in the forest.");

    // Advance to conclusion slide of Chapter 1
    fireEvent.click(screen.getByTestId("turn-next-btn")); // page 1
    fireEvent.click(screen.getByTestId("turn-next-btn")); // conclusion slide

    // Check that Continue to Chapter 2 button is present and no AI choices are shown
    expect(screen.getByTestId("continue-next-stored-chapter-btn")).toHaveTextContent("Continue to Chapter 2");
    expect(screen.queryByTestId("choice-0")).not.toBeInTheDocument();

    // Clear fetch history to verify zero network requests on continuing to Chapter 2
    fetch.mockClear();

    // Click Continue to Chapter 2
    fireEvent.click(screen.getByTestId("continue-next-stored-chapter-btn"));

    // Verify Chapter 2 loaded instantly without calling /generate-story
    expect(screen.getByTestId("current-chapter")).toHaveTextContent("Chapter 2");
    expect(screen.getByTestId("page-text")).toHaveTextContent("Chapter 2: The stone door revealed a hidden underground cavern.");
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining("/generate-story"), expect.anything());
  });

  it("shows AI choices at the frontier chapter and appends newly generated chapter to storybook", async () => {
    jest.spyOn(storyHistory, "loadHistory").mockReturnValue([sampleMultiChapterStory]);
    const updateStorySpy = jest.spyOn(storyHistory, "updateStory");

    // Mock generation for Chapter 3
    fetch.mockImplementation((url) => {
      if (url.includes("/generate-story")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              pages: [
                { text: "Chapter 3: Across the crystal bridge, a friendly dragon greeted them." },
                { text: "Chapter 3: They shared a peaceful twilight feast." },
              ],
              lesson: "True bravery builds bridges of friendship.",
              choices: ["Camp with the dragon", "Fly toward the morning star"],
              chapter: 3,
            }),
        });
      }
      if (url.includes("/illustrate")) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(["image"], { type: "image/png" })),
        });
      }
      return Promise.resolve({ ok: true });
    });

    render(<App />);

    // Open story
    fireEvent.click(screen.getByRole("button", { name: /View History/i }));
    fireEvent.click(screen.getByTestId("history-card-test-multi-ch-123"));

    // Turn through Chapter 1 to Chapter 2
    fireEvent.click(screen.getByTestId("turn-next-btn"));
    fireEvent.click(screen.getByTestId("turn-next-btn"));
    fireEvent.click(screen.getByTestId("continue-next-stored-chapter-btn"));

    // Now at Chapter 2 (frontier)
    expect(screen.getByTestId("current-chapter")).toHaveTextContent("Chapter 2");

    // Advance to conclusion slide of Chapter 2
    fireEvent.click(screen.getByTestId("turn-next-btn"));
    fireEvent.click(screen.getByTestId("turn-next-btn"));

    // Since Chapter 2 is the frontier, it should show the AI choices!
    expect(screen.queryByTestId("continue-next-stored-chapter-btn")).not.toBeInTheDocument();
    expect(screen.getByTestId("choice-0")).toHaveTextContent("Cross the crystal bridge");
    expect(screen.getByTestId("choice-1")).toHaveTextContent("Follow the subterranean river");

    // Select Choice 0 to generate Chapter 3
    fireEvent.click(screen.getByTestId("choice-0"));

    // Loading screen then Chapter 3 appears
    await waitFor(() => {
      expect(screen.getByTestId("current-chapter")).toHaveTextContent("Chapter 3");
    });

    // Check that updateStory was called with chapters array containing Chapter 1, 2, and 3
    expect(updateStorySpy).toHaveBeenCalledWith(
      "test-multi-ch-123",
      expect.objectContaining({
        chapter: 3,
        chapters: expect.arrayContaining([
          expect.objectContaining({ chapter: 1 }),
          expect.objectContaining({ chapter: 2 }),
          expect.objectContaining({ chapter: 3 }),
        ]),
      })
    );
  });

  it("does not jump to page 2 when reopening story from history, staying firmly on page 1", async () => {
    jest.spyOn(storyHistory, "loadHistory").mockReturnValue([sampleMultiChapterStory]);
    jest.useFakeTimers();

    render(<App />);

    // Open History and select story
    fireEvent.click(screen.getByRole("button", { name: /View History/i }));
    fireEvent.click(screen.getByTestId("history-card-test-multi-ch-123"));

    // Verify on page 1 (index 0)
    expect(screen.getByTestId("page-text")).toHaveTextContent("Chapter 1: The mysterious glowing tree in the forest.");

    // Simulate silent priming audio ending immediately
    const audioElement = document.querySelector("audio");
    if (audioElement) {
      audioElement.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
      fireEvent.ended(audioElement);
    }

    // Advance timers by 1500ms (more than the 1200ms turnTimer)
    jest.advanceTimersByTime(1500);

    // MUST still be on page 1!
    expect(screen.getByTestId("page-text")).toHaveTextContent("Chapter 1: The mysterious glowing tree in the forest.");
    expect(screen.queryByText(/Maya and Leo found a glowing key/)).not.toBeInTheDocument();

    jest.useRealTimers();
  });
});
