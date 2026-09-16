import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock StoryScreen to avoid ESM issues with swiper in Jest while preserving props behavior
jest.mock("../components/StoryScreen", () => ({ pages, pageIndex, onTurn, isNarrating, onToggleNarration }) => (
  <div data-testid="story-screen">
    <p>{typeof pages[pageIndex] === "object" ? pages[pageIndex].text : pages[pageIndex]}</p>
    <button onClick={() => onTurn(pageIndex + 1)}>Next</button>
    <button onClick={onToggleNarration}>Toggle Narration</button>
    <span data-testid="narrating">{isNarrating ? "yes" : "no"}</span>
  </div>
));

import App from "../App";
import { StorageService } from "../utils/storage";

describe("App Narration Auto-Start & Playback Lifecycle", () => {
  let mockFetch;
  let narrateCalls = [];
  let generateCalls = [];
  let mockAudioPlay;
  let mockAudioPause;
  let mockAudioLoad;
  let originalFetch;

  beforeEach(() => {
    StorageService.removeItem("familyStoryNight_history");
    StorageService.removeItem("familyStoryNight_voice");
    StorageService.removeItem("familyStoryNight_settings");
    StorageService.removeItem("familyStoryNight_analytics");

    narrateCalls = [];
    generateCalls = [];

    originalFetch = global.fetch;
    mockFetch = jest.fn((url, options) => {
      if (url.includes("/generate-story")) {
        const body = JSON.parse(options?.body || "{}");
        generateCalls.push(body);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            pages: [
              "Page 1: In a quiet grove, Maya found a glowing map.",
              "Page 2: The map revealed three ancient stones.",
              "Page 3: Under the moonlight, a friendly dragon arrived.",
              "Page 4: Together they celebrated a wonderful night.",
            ],
          }),
        });
      }
      if (url.includes("/narrate")) {
        const body = JSON.parse(options?.body || "{}");
        narrateCalls.push(body);
        return Promise.resolve({
          ok: true,
          blob: async () => new Blob(["audio-bytes"], { type: "audio/mp3" }),
        });
      }
      if (url.includes("/illustrate")) {
        return Promise.resolve({
          ok: true,
          blob: async () => new Blob(["image-bytes"], { type: "image/png" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    global.fetch = mockFetch;

    // Mock HTMLAudioElement
    mockAudioPlay = jest.fn().mockResolvedValue(undefined);
    mockAudioPause = jest.fn();
    mockAudioLoad = jest.fn();

    HTMLAudioElement.prototype.play = mockAudioPlay;
    HTMLAudioElement.prototype.pause = mockAudioPause;
    HTMLAudioElement.prototype.load = mockAudioLoad;

    global.URL.createObjectURL = jest.fn((blob) => `blob:mock-${Math.random()}`);
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("automatically starts reading aloud page 0 after story generation completes", async () => {
    render(<App />);

    // Enter name
    const input = screen.getByPlaceholderText("Maya, Dad, Biscuit the dog");
    fireEvent.change(input, { target: { value: "Maya" } });

    // Click Begin the story
    const submitBtn = screen.getByRole("button", { name: "Begin the story" });
    fireEvent.click(submitBtn);

    // Audio should be primed during the click gesture
    expect(mockAudioPlay).toHaveBeenCalled();

    // Wait for transition to story screen
    await waitFor(() => {
      expect(screen.getByText(/In a quiet grove/)).toBeInTheDocument();
    });

    // Exactly one narration fetch should be issued for page 0
    await waitFor(() => {
      expect(narrateCalls.length).toBe(1);
    });

    expect(narrateCalls[0].text).toContain("In a quiet grove");
    expect(narrateCalls[0].voiceId).toBe("Joanna");

    // Audio play should be called for page 0 narration
    await waitFor(() => {
      // Priming call + page 0 playback call
      expect(mockAudioPlay.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("narrates page 2 when turned and auto-advances when audio ends", async () => {
    render(<App />);

    const input = screen.getByPlaceholderText("Maya, Dad, Biscuit the dog");
    fireEvent.change(input, { target: { value: "Maya" } });
    fireEvent.click(screen.getByRole("button", { name: "Begin the story" }));

    await waitFor(() => {
      expect(screen.getByText(/In a quiet grove/)).toBeInTheDocument();
    });

    expect(narrateCalls.length).toBe(1);

    jest.useFakeTimers();

    // Simulate audio "ended" event to test auto-advance after 1200ms
    const audioElement = document.querySelector("audio");
    expect(audioElement).toBeInTheDocument();

    act(() => {
      audioElement.dispatchEvent(new Event("ended"));
      jest.advanceTimersByTime(1200);
    });

    jest.useRealTimers();

    // Should now be on page 2
    await waitFor(() => {
      expect(screen.getByText(/The map revealed three ancient stones/)).toBeInTheDocument();
    });

    // Second page narration fetch should have been called
    expect(narrateCalls.length).toBe(2);
    expect(narrateCalls[1].text).toContain("The map revealed three ancient stones");
  });

  it("handles object-based story pages correctly without sending [object Object]", async () => {
    mockFetch.mockImplementation((url, options) => {
      if (url.includes("/generate-story")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            pages: [
              { text: "Object page text 1" },
              { text: "Object page text 2" },
            ],
          }),
        });
      }
      if (url.includes("/narrate")) {
        const body = JSON.parse(options?.body || "{}");
        narrateCalls.push(body);
        return Promise.resolve({
          ok: true,
          blob: async () => new Blob(["audio-bytes"]),
        });
      }
      if (url.includes("/illustrate")) {
        return Promise.resolve({
          ok: true,
          blob: async () => new Blob(["image-bytes"], { type: "image/png" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<App />);

    const input = screen.getByPlaceholderText("Maya, Dad, Biscuit the dog");
    fireEvent.change(input, { target: { value: "Maya" } });
    fireEvent.click(screen.getByRole("button", { name: "Begin the story" }));

    await waitFor(() => {
      expect(screen.getByText("Object page text 1")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(narrateCalls.length).toBe(1);
    });

    expect(narrateCalls[0].text).toBe("Object page text 1");
  });
});
