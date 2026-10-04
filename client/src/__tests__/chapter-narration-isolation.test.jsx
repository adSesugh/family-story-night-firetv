import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock StoryScreen to preserve narration and chapter props without swiper ESM issues
jest.mock("../components/StoryScreen", () => ({
  pages,
  pageIndex,
  onTurn,
  isNarrating,
  onToggleNarration,
  chapter,
  nextStoredChapterNumber,
  onContinueNextStoredChapter,
  onSelectChoice,
  choices,
}) => (
  <div data-testid="story-screen">
    <div data-testid="current-chapter">Chapter {chapter}</div>
    <div data-testid="current-page-text">
      {typeof pages[pageIndex] === "object" ? pages[pageIndex].text : pages[pageIndex]}
    </div>
    <button onClick={() => onTurn(pageIndex + 1)}>Next Page</button>
    <button onClick={onToggleNarration}>Toggle Narration</button>
    {choices && choices.map((c, i) => (
      <button key={i} onClick={() => onSelectChoice && onSelectChoice(c)}>
        {c}
      </button>
    ))}
    {nextStoredChapterNumber && (
      <button onClick={onContinueNextStoredChapter}>
        Continue to Chapter {nextStoredChapterNumber}
      </button>
    )}
    <span data-testid="narrating">{isNarrating ? "yes" : "no"}</span>
  </div>
));

import App from "../App";
import { StorageService } from "../utils/storage";
import * as storyHistory from "../utils/storyHistory";

describe("Chapter Narration Isolation (Read Out Loud)", () => {
  let narrateCalls = [];
  let mockAudioPlay;
  let mockAudioPause;
  let mockAudioLoad;
  let playedAudioSources = [];

  beforeEach(() => {
    StorageService.removeItem("familyStoryNight_history");
    StorageService.removeItem("familyStoryNight_voice");
    StorageService.removeItem("familyStoryNight_settings");
    StorageService.removeItem("familyStoryNight_analytics");

    narrateCalls = [];
    playedAudioSources = [];

    // Mock HTMLAudioElement
    mockAudioPlay = jest.fn().mockImplementation(function () {
      playedAudioSources.push(this.src);
      return Promise.resolve();
    });
    mockAudioPause = jest.fn();
    mockAudioLoad = jest.fn();

    HTMLAudioElement.prototype.play = mockAudioPlay;
    HTMLAudioElement.prototype.pause = mockAudioPause;
    HTMLAudioElement.prototype.load = mockAudioLoad;

    global.URL.createObjectURL = jest.fn((blob) => `blob:mock-audio-${Math.random()}`);
    global.URL.revokeObjectURL = jest.fn();

    global.fetch = jest.fn((url, options) => {
      const urlStr = typeof url === "string" ? url : url.toString();

      if (urlStr.includes("/generate-story")) {
        const body = JSON.parse(options?.body || "{}");
        if (body.chapter === 2) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              id: body.storyId || "story-101",
              pages: [
                { text: "Chapter 2 page 1: Entering the glowing crystal cave.", scene: "Cave entrance" },
                { text: "Chapter 2 page 2: The crystals chimed like musical bells.", scene: "Crystal bells" },
              ],
              lesson: "Bravery opens hidden doors.",
              choices: ["Deep into the canyon", "Back up the mountain"],
              chapter: 2,
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: "story-101",
            pages: [
              { text: "Chapter 1 page 1: Leo found an enchanted golden compass.", scene: "Forest glade" },
              { text: "Chapter 1 page 2: The compass needle spun toward a hidden trail.", scene: "Hidden trail" },
            ],
            lesson: "Curiosity lights every step.",
            choices: ["Follow the glowing cave path", "Climb the ancient tree"],
            chapter: 1,
          }),
        });
      }

      if (urlStr.includes("/narrate")) {
        const body = JSON.parse(options?.body || "{}");
        narrateCalls.push(body);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            audio: `data:audio/mpeg;base64,mock-audio-for-ch${body.chapter || 1}-p${body.pageIndex}`,
            speechMarks: [
              { time: 0, type: "word", start: 0, end: 7, value: "Chapter" },
            ],
          }),
        });
      }

      if (urlStr.includes("/illustrate")) {
        return Promise.resolve({
          ok: true,
          blob: async () => new Blob(["fake-image"], { type: "image/png" }),
        });
      }

      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("narrates Chapter 2 page 0 text instead of replaying Chapter 1 audio when moving to Chapter 2", async () => {
    render(<App />);

    // Start story
    const input = screen.getByPlaceholderText(/Maya, Dad, Biscuit the dog/i);
    fireEvent.change(input, { target: { value: "Leo" } });
    const startBtn = screen.getByRole("button", { name: /Begin the story/i });
    fireEvent.click(startBtn);

    // Wait for Chapter 1 to load
    await waitFor(() => {
      expect(screen.getByTestId("current-chapter")).toHaveTextContent("Chapter 1");
      expect(screen.getByTestId("current-page-text")).toHaveTextContent("Chapter 1 page 1: Leo found an enchanted golden compass.");
    });

    // Verify Chapter 1 Page 0 narration was requested
    await waitFor(() => {
      expect(narrateCalls.length).toBeGreaterThanOrEqual(1);
    });
    const ch1Page0Call = narrateCalls.find((c) => c.text && c.text.includes("Chapter 1 page 1"));
    expect(ch1Page0Call).toBeDefined();
    expect(ch1Page0Call.chapter).toBe(1);
    expect(ch1Page0Call.pageIndex).toBe(0);

    // Turn to Chapter 1 Page 2
    fireEvent.click(screen.getByText("Next Page"));

    await waitFor(() => {
      expect(screen.getByTestId("current-page-text")).toHaveTextContent("Chapter 1 page 2: The compass needle spun toward a hidden trail.");
    });

    // Advance to conclusion / choices
    fireEvent.click(screen.getByText("Next Page"));

    await waitFor(() => {
      expect(screen.getByText("Follow the glowing cave path")).toBeInTheDocument();
    });

    // Select choice to proceed to Chapter 2
    fireEvent.click(screen.getByText("Follow the glowing cave path"));

    // Wait for Chapter 2 to load
    await waitFor(() => {
      expect(screen.getByTestId("current-chapter")).toHaveTextContent("Chapter 2");
      expect(screen.getByTestId("current-page-text")).toHaveTextContent("Chapter 2 page 1: Entering the glowing crystal cave.");
    });

    // Verify that Chapter 2 Page 0 narration was requested with chapter 2 and chapter 2 text
    await waitFor(() => {
      const ch2Page0Call = narrateCalls.find((c) => c.text && c.text.includes("Chapter 2 page 1"));
      expect(ch2Page0Call).toBeDefined();
      expect(ch2Page0Call.chapter).toBe(2);
      expect(ch2Page0Call.pageIndex).toBe(0);
    });

    // Verify that the audio played does NOT contain Chapter 1's audio data URL
    await waitFor(() => {
      const ch2AudioUrl = playedAudioSources.find((src) => src && src.includes("mock-audio-for-ch2-p0"));
      expect(ch2AudioUrl).toBeDefined();
    });
  });

  it("does not repeat chapter 1 when navigating stored chapters", async () => {
    // Seed a 2-chapter story in history
    const multiChapterStory = {
      id: "stored-story-99",
      familyMembers: ["Maya"],
      theme: "The Star Mountain",
      chapter: 2,
      firstPage: "Chapter 1 page 1",
      chapters: [
        {
          chapter: 1,
          pages: [
            { text: "Ch 1 text page 1" },
            { text: "Ch 1 text page 2" },
          ],
          lesson: "Patience",
          choices: ["Up the cliff"],
        },
        {
          chapter: 2,
          pages: [
            { text: "Ch 2 text page 1 on the summit" },
            { text: "Ch 2 text page 2 under stars" },
          ],
          lesson: "Peace",
          choices: [],
        },
      ],
      pages: [
        { text: "Ch 1 text page 1" },
        { text: "Ch 1 text page 2" },
      ],
      narrations: {
        "0": {
          audio: "data:audio/mpeg;base64,ch1-page0-old-audio",
          speechMarks: [],
          voiceId: "Joanna",
        },
        "ch1_0": {
          audio: "data:audio/mpeg;base64,ch1-page0-old-audio",
          speechMarks: [],
          voiceId: "Joanna",
        },
        "ch2_0": {
          audio: "data:audio/mpeg;base64,ch2-page0-correct-audio",
          speechMarks: [],
          voiceId: "Joanna",
        },
      },
    };

    jest.spyOn(storyHistory, "loadHistory").mockReturnValue([multiChapterStory]);

    render(<App />);

    // Open history
    const historyBtn = screen.getByRole("button", { name: /View History/i });
    fireEvent.click(historyBtn);

    const storyHeading = screen.getByRole("heading", { name: "The Star Mountain" });
    expect(storyHeading).toBeInTheDocument();

    // Select story from history
    fireEvent.click(storyHeading);

    await waitFor(() => {
      expect(screen.getByTestId("current-chapter")).toHaveTextContent("Chapter 1");
    });

    // Advance Chapter 1 to conclusion
    fireEvent.click(screen.getByText("Next Page"));
    fireEvent.click(screen.getByText("Next Page"));

    await waitFor(() => {
      expect(screen.getByText(/Continue to Chapter 2/i)).toBeInTheDocument();
    });

    // Continue to Chapter 2
    fireEvent.click(screen.getByText(/Continue to Chapter 2/i));

    await waitFor(() => {
      expect(screen.getByTestId("current-chapter")).toHaveTextContent("Chapter 2");
      expect(screen.getByTestId("current-page-text")).toHaveTextContent("Ch 2 text page 1 on the summit");
    });

    // Verify Chapter 2 played Chapter 2's narration, NOT Chapter 1's "ch1-page0-old-audio"
    await waitFor(() => {
      const playedCh2 = playedAudioSources.find((src) => src && src.includes("ch2-page0-correct-audio"));
      expect(playedCh2).toBeDefined();
    });

    const playedStaleCh1InCh2 = playedAudioSources.filter(
      (src) => src && src.includes("ch1-page0-old-audio")
    );
    expect(playedStaleCh1InCh2.length).toBeLessThanOrEqual(1);
  });
});
