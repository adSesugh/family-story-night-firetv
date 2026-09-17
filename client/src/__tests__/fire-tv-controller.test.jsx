import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import App from "../App";

// Mock child components to isolate App-level keydown handling
jest.mock("../components/StoryScreen", () => {
  return function MockStoryScreen({ pages, pageIndex, isNarrating, onToggleNarration }) {
    return (
      <div data-testid="story-screen">
        <span data-testid="current-page">{pageIndex}</span>
        <span data-testid="is-narrating">{isNarrating ? "narrating" : "paused"}</span>
        <button onClick={onToggleNarration} data-testid="toggle-narrate-btn">
          Toggle
        </button>
      </div>
    );
  };
});

describe("Fire TV Remote & Gamepad Controller Support", () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn((url) => {
      if (url.includes("/generate-story")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              pages: ["Page 1 text", "Page 2 text", "Page 3 text"],
            }),
        });
      }
      if (url.includes("/narrate")) {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(["audio-data"], { type: "audio/mpeg" })),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
    window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = jest.fn();
    window.HTMLMediaElement.prototype.load = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("D-pad Up/Down selects theme in setup, and Select (Enter / keyCode 13) triggers story generation", async () => {
    render(<App />);

    // Press D-pad Down (keyCode 40)
    fireEvent.keyDown(window, { key: "ArrowDown", keyCode: 40 });
    // Press D-pad Up (keyCode 38)
    fireEvent.keyDown(window, { key: "ArrowUp", keyCode: 38 });

    // Fill name and press Select (Enter / keyCode 13)
    const input = screen.getByPlaceholderText(/Maya, Dad/i);
    fireEvent.change(input, { target: { value: "Liam" } });

    fireEvent.keyDown(input, { key: "Enter", keyCode: 13 });

    await waitFor(() => {
      expect(screen.getByTestId("story-screen")).toBeInTheDocument();
    });
  });

  test("Fire TV Play/Pause button (keyCode 179 / MediaPlayPause) toggles narration in story screen", async () => {
    render(<App />);

    // Navigate to story screen
    const input = screen.getByPlaceholderText(/Maya, Dad/i);
    fireEvent.change(input, { target: { value: "Liam" } });
    fireEvent.click(screen.getByRole("button", { name: /Begin the story/i }));

    await waitFor(() => {
      expect(screen.getByTestId("story-screen")).toBeInTheDocument();
    });

    // Press Fire TV Play/Pause button (keyCode 179)
    fireEvent.keyDown(window, { key: "MediaPlayPause", keyCode: 179 });
    // Audio pause should have been called or play toggled
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  test("Fire TV Fast Forward (keyCode 228) and Rewind (keyCode 227) turn pages in story screen", async () => {
    render(<App />);

    const input = screen.getByPlaceholderText(/Maya, Dad/i);
    fireEvent.change(input, { target: { value: "Liam" } });
    fireEvent.click(screen.getByRole("button", { name: /Begin the story/i }));

    await waitFor(() => {
      expect(screen.getByTestId("story-screen")).toBeInTheDocument();
      expect(screen.getByTestId("current-page").textContent).toBe("0");
    });

    // Press Fast Forward (keyCode 228)
    fireEvent.keyDown(window, { key: "MediaFastForward", keyCode: 228 });
    await waitFor(() => {
      expect(screen.getByTestId("current-page").textContent).toBe("1");
    });

    // Press Rewind (keyCode 227)
    fireEvent.keyDown(window, { key: "MediaRewind", keyCode: 227 });
    await waitFor(() => {
      expect(screen.getByTestId("current-page").textContent).toBe("0");
    });
  });

  test("Fire TV Back button (keyCode 4 / GoBack) navigates back to setup from story screen", async () => {
    render(<App />);

    const input = screen.getByPlaceholderText(/Maya, Dad/i);
    fireEvent.change(input, { target: { value: "Liam" } });
    fireEvent.click(screen.getByRole("button", { name: /Begin the story/i }));

    await waitFor(() => {
      expect(screen.getByTestId("story-screen")).toBeInTheDocument();
    });

    // Press Fire TV Back button (keyCode 4 / GoBack)
    fireEvent.keyDown(window, { key: "GoBack", keyCode: 4 });

    await waitFor(() => {
      expect(screen.queryByTestId("story-screen")).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Maya, Dad/i)).toBeInTheDocument();
    });
  });

  test("Fire TV Back button (keyCode 4) navigates back to setup from history screen", async () => {
    // Seed history so history button shows
    localStorage.setItem(
      "familyStoryNight_history",
      JSON.stringify({
        version: 1,
        stories: [
          {
            id: "hist-1",
            generatedAt: new Date().toISOString(),
            familyMembers: ["Liam"],
            theme: "a cozy adventure",
            firstPage: "Once upon a time...",
            pages: ["Page 1"],
          },
        ],
      })
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /View History/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /View History/i }));
    expect(screen.getByText(/Story History/i)).toBeInTheDocument();

    // Press Fire TV Back button (keyCode 4)
    fireEvent.keyDown(window, { key: "GoBack", keyCode: 4 });

    await waitFor(() => {
      expect(screen.queryByText(/Story History/i)).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Maya, Dad/i)).toBeInTheDocument();
    });
  });

  test("Gamepad B button (keyCode 8) navigates back to setup from settings screen", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /Parent Settings/i }));
    expect(screen.getByRole("heading", { name: /^Settings$/i })).toBeInTheDocument();

    // Press Gamepad B button (keyCode 8 / Backspace)
    fireEvent.keyDown(window, { key: "Backspace", keyCode: 8 });

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: /^Settings$/i })).not.toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Maya, Dad/i)).toBeInTheDocument();
    });
  });
});
