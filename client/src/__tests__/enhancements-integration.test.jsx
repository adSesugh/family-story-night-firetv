import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("../components/StoryScreen", () => () => <div data-testid="story-screen">Story Screen</div>);

import App from "../App";
import { StorageService } from "../utils/storage";
import { loadEvents, ANALYTICS_STORAGE_KEY } from "../utils/analytics";
import { PARENT_SETTINGS_KEY } from "../utils/parentSettings";

// Mock global fetch
const originalFetch = global.fetch;

describe("Enhancements Full Integration (Tasks 7.3, 9.1, 11.1, 19.2)", () => {
  beforeEach(() => {
    StorageService.removeItem("familyStoryNight_history");
    StorageService.removeItem("familyStoryNight_voice");
    StorageService.removeItem(PARENT_SETTINGS_KEY);
    StorageService.removeItem(ANALYTICS_STORAGE_KEY);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    StorageService.removeItem("familyStoryNight_history");
    StorageService.removeItem("familyStoryNight_voice");
    StorageService.removeItem(PARENT_SETTINGS_KEY);
    StorageService.removeItem(ANALYTICS_STORAGE_KEY);
  });

  it("passes isCustomTheme: true and custom theme string to /generate-story configured in Settings (Task 7.3)", async () => {
    let requestBody = null;
    global.fetch = jest.fn((url, options) => {
      if (url.includes("/generate-story")) {
        requestBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            pages: ["Page 1 text", "Page 2 text", "Page 3 text", "Page 4 text"],
          }),
        });
      }
      if (url.includes("/narrate")) {
        return Promise.resolve({
          ok: true,
          blob: async () => new Blob(["audio"]),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<App />);

    // Open settings to configure custom theme
    const settingsBtn = screen.getByRole("button", { name: "Parent Settings" });
    fireEvent.click(settingsBtn);

    // Switch to custom theme
    const customToggle = screen.getByRole("button", { name: "Custom" });
    fireEvent.click(customToggle);

    // Enter custom theme
    const textarea = screen.getByPlaceholderText("Describe your custom story theme...");
    fireEvent.change(textarea, { target: { value: "a magical time-traveling castle" } });

    // Return to setup screen
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));

    // Enter family members
    const nameInput = screen.getByPlaceholderText("Maya, Dad, Biscuit the dog");
    fireEvent.change(nameInput, { target: { value: "Maya, Dad" } });

    // Submit
    const submitBtn = screen.getByRole("button", { name: "Begin the story" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(requestBody).not.toBeNull();
    });

    expect(requestBody.isCustomTheme).toBe(true);
    expect(requestBody.theme).toBe("a magical time-traveling castle");
    expect(requestBody.familyMembers).toEqual(["Maya", "Dad"]);
  });

  it("passes storyLength and voiceId configured in Settings and tracks story_generated analytics (Tasks 9.1, 11.1, 19.2)", async () => {
    let generateBody = null;
    let narrateBodies = [];

    global.fetch = jest.fn((url, options) => {
      if (url.includes("/generate-story")) {
        generateBody = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            pages: [
              "Page 1",
              "Page 2",
              "Page 3",
              "Page 4",
              "Page 5",
              "Page 6",
              "Page 7",
              "Page 8",
            ],
          }),
        });
      }
      if (url.includes("/narrate")) {
        narrateBodies.push(JSON.parse(options.body));
        return Promise.resolve({
          ok: true,
          blob: async () => new Blob(["audio"]),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<App />);

    // Open settings to select Matthew voice
    const settingsBtn = screen.getByRole("button", { name: "Parent Settings" });
    fireEvent.click(settingsBtn);

    const voiceSelect = screen.getByLabelText("Narrator Voice");
    fireEvent.change(voiceSelect, { target: { value: "Matthew" } });

    // Return to setup screen
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));

    const nameInput = screen.getByPlaceholderText("Maya, Dad, Biscuit the dog");
    fireEvent.change(nameInput, { target: { value: "Maya" } });

    // Select Long (8p)
    const longLengthBtn = screen.getByRole("button", { name: /Long/ });
    fireEvent.click(longLengthBtn);

    // Submit
    fireEvent.click(screen.getByRole("button", { name: "Begin the story" }));

    await waitFor(() => {
      expect(generateBody).not.toBeNull();
    });

    expect(generateBody.storyLength).toBe(8);
    expect(generateBody.isCustomTheme).toBe(false);

    // Verify narration included voiceId: "Matthew"
    await waitFor(() => {
      expect(narrateBodies.length).toBeGreaterThan(0);
    });
    expect(narrateBodies[0].voiceId).toBe("Matthew");

    // Verify story_generated analytics event tracked
    const events = loadEvents();
    const storyGenEvent = events.find((e) => e.type === "story_generated");
    expect(storyGenEvent).toBeDefined();
    expect(storyGenEvent.data.voice).toBe("Matthew");
    expect(storyGenEvent.data.storyLength).toBe(8);
    expect(storyGenEvent.data.familyMembers).toEqual(["Maya"]);
  });

  it("navigates to settings and preserves parent settings changes (Task 16.1)", async () => {
    render(<App />);

    // Open settings
    const settingsBtn = screen.getByRole("button", { name: "Parent Settings" });
    fireEvent.click(settingsBtn);

    expect(screen.getByText("Create a 4-Digit Parent PIN")).toBeInTheDocument();

    // Create PIN
    const inputs = screen.getAllByPlaceholderText("••••");
    fireEvent.change(inputs[0], { target: { value: "1234" } });
    fireEvent.change(inputs[1], { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Save PIN" }));

    expect(screen.getByText("Content & Feature Preferences")).toBeInTheDocument();

    // Toggle off Custom Themes
    const customCheckbox = screen.getByLabelText("Allow Custom Themes");
    fireEvent.click(customCheckbox);

    // Verify Custom button is now hidden in Settings
    expect(screen.queryByRole("button", { name: "Custom" })).not.toBeInTheDocument();

    // Go back
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));

    // Verify back on setup screen
    expect(screen.getByText("Who’s in tonight’s story?")).toBeInTheDocument();
  });
});
