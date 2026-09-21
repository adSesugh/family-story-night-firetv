import React from "react";
import { render, screen, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useAlexaVoiceSync } from "../utils/useAlexaVoiceSync";
import SetupScreen from "../components/SetupScreen";

describe("Alexa Voice Synchronization (Client)", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    jest.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it("registers session on mount and sets pairing code", async () => {
    global.fetch = jest.fn((url) => {
      if (url.includes("/alexa/session")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ sessionId: "test-session", pairingCode: "4821" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ events: [] }),
      });
    });

    const { result } = renderHook(() =>
      useAlexaVoiceSync({ apiBase: "http://localhost:4000", pollIntervalMs: 500 })
    );

    // Allow initial fetch to resolve
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.pairingCode).toBe("4821");
    expect(result.current.isConnected).toBe(true);
  });

  it("dispatches voice commands received during polling", async () => {
    const onSetNamesMock = jest.fn();
    const onSetThemeMock = jest.fn();
    const onStartStoryMock = jest.fn();
    const onNavigatePageMock = jest.fn();
    const onToggleNarrationMock = jest.fn();

    let pollCount = 0;
    global.fetch = jest.fn((url) => {
      if (url.includes("/alexa/session")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ sessionId: "test-session", pairingCode: "9912" }),
        });
      }
      if (url.includes("/alexa/events")) {
        pollCount++;
        if (pollCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                events: [
                  { type: "SET_NAMES", names: "Maya and Liam" },
                  { type: "SET_THEME", theme: "outer space" },
                ],
              }),
          });
        }
        if (pollCount === 2) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                events: [
                  { type: "START_STORY" },
                  { type: "NAVIGATE_PAGE", direction: "next" },
                  { type: "TOGGLE_NARRATION" },
                ],
              }),
          });
        }
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ events: [] }),
      });
    });

    renderHook(() =>
      useAlexaVoiceSync({
        apiBase: "http://localhost:4000",
        pollIntervalMs: 500,
        onSetNames: onSetNamesMock,
        onSetTheme: onSetThemeMock,
        onStartStory: onStartStoryMock,
        onNavigatePage: onNavigatePageMock,
        onToggleNarration: onToggleNarrationMock,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Advance timer for first poll
    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(onSetNamesMock).toHaveBeenCalledWith("Maya and Liam");
    expect(onSetThemeMock).toHaveBeenCalledWith("outer space");

    // Advance timer for second poll
    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(onStartStoryMock).toHaveBeenCalled();
    expect(onNavigatePageMock).toHaveBeenCalledWith("next");
    expect(onToggleNarrationMock).toHaveBeenCalled();
  });

  it("renders the Alexa Code badge in SetupScreen when alexaPairingCode is provided", () => {
    render(
      <SetupScreen
        names=""
        setNames={jest.fn()}
        themeIndex={0}
        setThemeIndex={jest.fn()}
        themes={["Enchanted Forest"]}
        alexaPairingCode="5842"
      />
    );

    expect(screen.getByText(/Alexa Code:/i)).toBeInTheDocument();
    expect(screen.getByText("5842")).toBeInTheDocument();
  });
});
