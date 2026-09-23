import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock StoryScreen to avoid ESM issues with swiper in Jest while preserving props behavior
jest.mock("../components/StoryScreen", () => ({
  pages,
  pageIndex,
  onTurn,
  choices,
  onSelectChoice,
  chapter,
}) => (
  <div data-testid="story-screen">
    <p>{typeof pages[pageIndex] === "object" ? pages[pageIndex].text : pages[pageIndex]}</p>
    <button onClick={() => onTurn(pageIndex + 1)}>Next</button>
    <div data-testid="chapter-indicator">Chapter {chapter}</div>
    {choices &&
      choices.map((c, idx) => (
        <button key={idx} onClick={() => onSelectChoice(c)}>
          {c}
        </button>
      ))}
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

describe("Continuous Storybooks & Chapter Continuation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.spyOn(storage.StorageService, "getItem").mockReturnValue(null);
    jest.spyOn(storage.StorageService, "setItem").mockReturnValue(true);

    fetch.mockImplementation((url) => {
      if (url.includes("/narrate")) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(["fake-audio"], { type: "audio/mpeg" })),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("updates the existing story in history when Chapter 2 is chosen instead of creating a duplicate story", async () => {
    // 1. Mock Chapter 1 story generation
    fetch.mockImplementation((url) => {
      if (url.includes("/generate-story")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              pages: [
                { text: "Page 1 of chapter 1", scene: "Scene 1" },
                { text: "Page 2 of chapter 1", scene: "Scene 2" },
              ],
              lesson: "Kindness is key.",
              choices: ["Explore the secret treehouse", "Follow the golden stream"],
              chapter: 1,
            }),
        });
      }
      if (url.includes("/illustrate")) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(["fake-image"], { type: "image/png" })),
        });
      }
      if (url.includes("/narrate")) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(["fake-audio"], { type: "audio/mpeg" })),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    const updateStorySpy = jest.spyOn(storyHistory, "updateStory");
    const saveStorySpy = jest.spyOn(storyHistory, "saveStory");

    render(<App />);

    // Fill family members & start story
    const input = screen.getByPlaceholderText(/Maya, Dad, Biscuit the dog/i);
    fireEvent.change(input, { target: { value: "Leo, Maya" } });

    const startBtn = screen.getByRole("button", { name: /Begin the story/i });
    fireEvent.click(startBtn);

    // Wait for Story Screen Chapter 1 to load
    await waitFor(() => {
      expect(screen.getByTestId("story-screen")).toBeInTheDocument();
    });

    // Chapter 1 calls saveStory once
    expect(saveStorySpy).toHaveBeenCalledTimes(1);
    const initialSavedId = saveStorySpy.mock.results[0].value.id;
    expect(initialSavedId).toBeDefined();

    // Now mock Chapter 2 generation
    fetch.mockImplementation((url) => {
      if (url.includes("/generate-story")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              pages: [
                { text: "Page 1 of chapter 2 inside the secret treehouse", scene: "Treehouse scene" },
                { text: "Page 2 of chapter 2 with stars twinkling", scene: "Night scene" },
              ],
              lesson: "Curiosity reveals wonders.",
              choices: ["Open the glowing trunk", "Look through the telescope"],
              chapter: 2,
            }),
        });
      }
      if (url.includes("/illustrate")) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(["fake-image"], { type: "image/png" })),
        });
      }
      if (url.includes("/narrate")) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(["fake-audio"], { type: "audio/mpeg" })),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    // We mocked StoryScreen to render choices directly
    await waitFor(() => {
      expect(screen.getByText("Explore the secret treehouse")).toBeInTheDocument();
    });

    // Select Choice 1 to proceed to Chapter 2
    fireEvent.click(screen.getByText("Explore the secret treehouse"));

    // Wait for Chapter 2 to load
    await waitFor(() => {
      expect(screen.getByText(/Page 1 of chapter 2 inside the secret treehouse/i)).toBeInTheDocument();
    });

    // Crucial assertion: updateStory was called with initialSavedId (NOT saveStory a second time!)
    expect(updateStorySpy).toHaveBeenCalledWith(
      initialSavedId,
      expect.objectContaining({
        chapter: 2,
        lesson: "Curiosity reveals wonders.",
      })
    );
    expect(saveStorySpy).toHaveBeenCalledTimes(1); // Still only 1 saveStory!
  });

  it("revisiting an old story from history restores context and advances that specific storybook", async () => {
    const existingStory = {
      id: "historic-story-42",
      theme: "The Starry Ark Adventure",
      category: "bible",
      familyMembers: ["Noah", "Maya"],
      generatedAt: "2026-09-17T20:00:00.000Z",
      chapter: 1,
      pages: [
        { text: "Historic chapter 1 text page 1", scene: "Ark scene 1" },
        { text: "Historic chapter 1 text page 2", scene: "Ark scene 2" },
      ],
      firstPage: "Historic chapter 1 text page 1",
      lesson: "Trust and patience bring peace.",
      choices: ["Send out the gentle dove", "Look at the colorful rainbow"],
    };

    jest.spyOn(storyHistory, "loadHistory").mockReturnValue([existingStory]);
    const updateStorySpy = jest.spyOn(storyHistory, "updateStory");
    const saveStorySpy = jest.spyOn(storyHistory, "saveStory");

    render(<App />);

    // Open History
    const historyBtn = screen.getByRole("button", { name: /View History/i });
    fireEvent.click(historyBtn);

    const storyHeading = screen.getByRole("heading", { name: "The Starry Ark Adventure" });
    expect(storyHeading).toBeInTheDocument();

    // Select this story from History
    fireEvent.click(storyHeading);

    await waitFor(() => {
      expect(screen.getByTestId("story-screen")).toBeInTheDocument();
      expect(screen.getByText(/Historic chapter 1 text page 1/i)).toBeInTheDocument();
    });

    // Advance to choices
    const nextBtn = screen.getByRole("button", { name: /Next/i });
    fireEvent.click(nextBtn); // page 2
    fireEvent.click(nextBtn); // conclusion

    await waitFor(() => {
      expect(screen.getByText("Send out the gentle dove")).toBeInTheDocument();
    });

    // Mock Chapter 2 generation
    fetch.mockImplementation((url, opts) => {
      if (url.includes("/generate-story")) {
        const body = JSON.parse(opts.body);
        // Verify restored context was passed to Bedrock!
        expect(body.theme).toBe("The Starry Ark Adventure");
        expect(body.category).toBe("bible");
        expect(body.familyMembers).toEqual(["Noah", "Maya"]);
        expect(body.chapter).toBe(2);

        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              pages: [
                { text: "The dove flew across peaceful blue waters", scene: "Dove scene" },
                { text: "It returned with an olive branch of hope", scene: "Olive branch" },
              ],
              lesson: "Hope always finds a way home.",
              choices: ["Celebrate with music", "Rest under the stars"],
              chapter: 2,
            }),
        });
      }
      if (url.includes("/illustrate")) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(["fake-image"], { type: "image/png" })),
        });
      }
      if (url.includes("/narrate")) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(["fake-audio"], { type: "audio/mpeg" })),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    // Click choice
    fireEvent.click(screen.getByText("Send out the gentle dove"));

    await waitFor(() => {
      expect(screen.getByText(/The dove flew across peaceful blue waters/i)).toBeInTheDocument();
    });

    // Crucial assertion: updateStory was called on 'historic-story-42'
    expect(updateStorySpy).toHaveBeenCalledWith(
      "historic-story-42",
      expect.objectContaining({
        chapter: 2,
        lesson: "Hope always finds a way home.",
      })
    );
    // saveStory was NOT called
    expect(saveStorySpy).not.toHaveBeenCalled();
  });
});
