import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock StoryScreen
jest.mock("../components/StoryScreen", () => ({ pages, illustrations = [], pageIndex, onTurn }) => (
  <div data-testid="story-screen">
    <p data-testid="story-text">{typeof pages[pageIndex] === "object" ? pages[pageIndex].text : pages[pageIndex]}</p>
    {illustrations[pageIndex] && (
      <img data-testid="story-illustration" src={illustrations[pageIndex]} alt="Illustration" />
    )}
    <span data-testid="page-index">{pageIndex}</span>
  </div>
));

import App from "../App";
import { StorageService } from "../utils/storage";
import { loadHistory, saveStory } from "../utils/storyHistory";

describe("Illustrations Immediate Display & LocalStorage Persistence", () => {
  let mockFetch;
  let originalFetch;

  beforeEach(() => {
    StorageService.removeItem("familyStoryNight_history");
    StorageService.removeItem("familyStoryNight_voice");
    StorageService.removeItem("familyStoryNight_settings");

    originalFetch = global.fetch;
    mockFetch = jest.fn((url, options) => {
      if (url.includes("/generate-story")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            pages: [
              "Page 1: In a quiet grove, Maya found a glowing map.",
              "Page 2: The map revealed three ancient stones.",
            ],
          }),
        });
      }
      if (url.includes("/illustrate")) {
        return Promise.resolve({
          ok: true,
          blob: async () => new Blob(["test-image-png"], { type: "image/png" }),
        });
      }
      if (url.includes("/narrate")) {
        return Promise.resolve({
          ok: true,
          blob: async () => new Blob(["audio-bytes"], { type: "audio/mp3" }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    global.fetch = mockFetch;
    global.URL.createObjectURL = jest.fn((blob) => `blob:mock-img-${Math.random()}`);
    global.URL.revokeObjectURL = jest.fn();

    HTMLAudioElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    HTMLAudioElement.prototype.pause = jest.fn();
    HTMLAudioElement.prototype.load = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("fetches page 0 illustration immediately during generation so it displays on story screen without delay", async () => {
    render(<App />);

    const input = screen.getByPlaceholderText("Maya, Dad, Biscuit the dog");
    fireEvent.change(input, { target: { value: "Maya" } });
    fireEvent.click(screen.getByRole("button", { name: "Begin the story" }));

    // Wait for transition to story screen
    await waitFor(() => {
      expect(screen.getByTestId("story-screen")).toBeInTheDocument();
    });

    // The first illustration MUST be present immediately
    const img = screen.getByTestId("story-illustration");
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBeTruthy();
  });

  it("persists illustrations into localStorage history alongside the story", async () => {
    render(<App />);

    const input = screen.getByPlaceholderText("Maya, Dad, Biscuit the dog");
    fireEvent.change(input, { target: { value: "Maya" } });
    fireEvent.click(screen.getByRole("button", { name: "Begin the story" }));

    await waitFor(() => {
      expect(screen.getByTestId("story-screen")).toBeInTheDocument();
    });

    // Verify localStorage has saved story with illustrations
    await waitFor(() => {
      const history = loadHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].illustrations).toBeDefined();
      expect(history[0].illustrations.length).toBeGreaterThan(0);
      expect(history[0].illustrations[0]).toBeTruthy();
    });
  });

  it("restores saved illustrations when opening a story from history", async () => {
    // Pre-populate history with an illustration
    saveStory({
      familyMembers: ["Maya"],
      theme: "a cozy adventure",
      pages: ["Saved story page 1", "Saved story page 2"],
      firstPage: "Saved story page 1",
      illustrations: ["data:image/png;base64,stored-image-data"],
    });

    render(<App />);

    // Click History button on SetupScreen
    const historyBtn = screen.getByRole("button", { name: /View History/i });
    fireEvent.click(historyBtn);

    // Click on the story entry in HistoryScreen
    await waitFor(() => {
      expect(screen.getByText("Saved story page 1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Saved story page 1"));

    // Story screen should open and immediately show the restored illustration from storage
    await waitFor(() => {
      expect(screen.getByTestId("story-screen")).toBeInTheDocument();
    });

    const img = screen.getByTestId("story-illustration");
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBe("data:image/png;base64,stored-image-data");
  });
});
