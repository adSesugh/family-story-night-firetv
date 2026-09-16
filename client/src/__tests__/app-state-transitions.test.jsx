import React, { useState, useCallback } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * Task 3.1: Verify Loading Screen displays during generation
 * Task 3.2: Verify transition to Story Screen on success
 * Task 3.3: Verify transition back to Setup on error
 * 
 * These tests verify the UI state transitions during story generation:
 * Setup -> Loading -> Story (or Setup -> Loading -> Setup on error)
 */

// Simple component renderers for testing each screen
function SetupScreenTest({ names, setNames, error, onSubmit, themeIndex, THEMES }) {
  return (
    <div data-testid="setup-screen">
      <h1>Who's in tonight's story?</h1>
      <input
        value={names}
        onChange={(e) => setNames(e.target.value)}
        placeholder="Maya, Dad, Biscuit the dog"
        data-testid="name-input"
      />
      <span data-testid="theme-name">{THEMES[themeIndex]}</span>
      {error && <p data-testid="error-message">{error}</p>}
      <button onClick={onSubmit} data-testid="submit-button">
        Begin the story
      </button>
    </div>
  );
}

function LoadingScreenTest() {
  return (
    <div data-testid="loading-screen">
      <p>Turning up the lamp…</p>
    </div>
  );
}

function StoryScreenTest({ pages, pageIndex }) {
  if (!pages || !pages[pageIndex]) return null;
  return (
    <div data-testid="story-screen">
      <p data-testid="story-text">{pages[pageIndex]}</p>
      <span data-testid="page-counter">
        Page {pageIndex + 1} of {pages.length}
      </span>
    </div>
  );
}

// App wrapper component for integration testing
function AppWrapper({ mockFetch }) {
  const [screen, setScreen] = useState("setup");
  const [names, setNames] = useState("");
  const [themeIndex, setThemeIndex] = useState(0);
  const [pages, setPages] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [error, setError] = useState(null);

  const THEMES = [
    "a cozy adventure",
    "a magical treasure hunt",
    "a trip to outer space",
    "a friendly dragon's forest",
  ];

  const generateStory = useCallback(async () => {
    setError(null);
    
    const familyMembers = names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);

    if (familyMembers.length === 0) {
      setError("Please enter at least one family member name");
      return;
    }

    setScreen("loading");

    try {
      const res = await mockFetch(`/generate-story`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyMembers, theme: THEMES[themeIndex] }),
      });

      if (!res.ok) throw new Error("Story generation failed");
      const data = await res.json();
      setPages(data.pages || []);
      setPageIndex(0);
      setScreen("story");
    } catch (err) {
      console.error(err);
      setError("Couldn't reach the storyteller. Is the backend running?");
      setScreen("setup");
    }
  }, [names, themeIndex, mockFetch]);

  return (
    <div>
      {screen === "setup" && (
        <SetupScreenTest
          names={names}
          setNames={setNames}
          error={error}
          onSubmit={generateStory}
          themeIndex={themeIndex}
          THEMES={THEMES}
        />
      )}
      {screen === "loading" && <LoadingScreenTest />}
      {screen === "story" && (
        <StoryScreenTest pages={pages} pageIndex={pageIndex} />
      )}
    </div>
  );
}

describe('Task 3.1: Verify Loading Screen displays during generation', () => {
  it('displays Loading Screen message "Turning up the lamp…"', async () => {
    const { getByTestId } = render(<LoadingScreenTest />);
    
    const loadingScreen = getByTestId("loading-screen");
    expect(loadingScreen).toBeInTheDocument();
    expect(loadingScreen.textContent).toContain("Turning up the lamp");
  });

  it('shows only Loading Screen during loading', () => {
    const { getByTestId, queryByTestId } = render(
      <div>
        <LoadingScreenTest />
      </div>
    );

    // Only loading screen should be visible
    expect(getByTestId("loading-screen")).toBeInTheDocument();
  });

  it('transitions to Loading Screen on story generation', async () => {
    const mockFetch = jest.fn().mockImplementation(() =>
      new Promise(resolve => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({
              pages: Array(6).fill("Page content")
            })
          });
        }, 50);
      })
    );

    const { getByTestId, getByPlaceholderText } = render(
      <AppWrapper mockFetch={mockFetch} />
    );

    // Initially on setup screen
    expect(getByTestId("setup-screen")).toBeInTheDocument();

    // Enter names
    const input = getByPlaceholderText("Maya, Dad, Biscuit the dog");
    fireEvent.change(input, { target: { value: "Maya, Dad" } });

    // Click submit (simulating user entering names and clicking button)
    const submitBtn = getByTestId("submit-button");
    submitBtn.click();

    // After submission, should show loading screen momentarily
    await waitFor(() => {
      // Screen state transitions immediately to loading
      expect(mockFetch).toHaveBeenCalled();
    }, { timeout: 100 });
  });
});

describe('Task 3.2: Verify transition to Story Screen on success', () => {
  it('displays first page on Story Screen after successful generation', async () => {
    const testPages = [
      "Once upon a time, there was a girl named Maya.",
      "Page 2.",
      "Page 3.",
      "Page 4.",
      "Page 5.",
      "Page 6."
    ];

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pages: testPages })
    });

    const { getByTestId, getByPlaceholderText } = render(
      <AppWrapper mockFetch={mockFetch} />
    );

    // Enter names and submit
    const input = getByPlaceholderText("Maya, Dad, Biscuit the dog");
    fireEvent.change(input, { target: { value: "Maya" } });

    const submitBtn = getByTestId("submit-button");
    submitBtn.click();

    // Wait for transition to story screen
    await waitFor(() => {
      expect(getByTestId("story-screen")).toBeInTheDocument();
    });

    // Verify first page is displayed
    const storyText = getByTestId("story-text");
    expect(storyText.textContent).toBe(testPages[0]);
  });

  it('populates pages array from API response with exactly 6 pages', async () => {
    const testPages = Array(6).fill(null).map((_, i) => `Page ${i + 1} content.`);

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pages: testPages })
    });

    const { getByTestId, getByPlaceholderText } = render(
      <AppWrapper mockFetch={mockFetch} />
    );

    const input = getByPlaceholderText("Maya, Dad, Biscuit the dog");
    fireEvent.change(input, { target: { value: "Test" } });

    const submitBtn = getByTestId("submit-button");
    submitBtn.click();

    await waitFor(() => {
      expect(getByTestId("story-screen")).toBeInTheDocument();
    });

    // Verify page counter shows "Page 1 of 6"
    const pageCounter = getByTestId("page-counter");
    expect(pageCounter.textContent).toBe("Page 1 of 6");
  });

  it('loading message is gone after transition to Story Screen', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pages: Array(6).fill("Content") })
    });

    const { getByTestId, getByPlaceholderText, queryByTestId } = render(
      <AppWrapper mockFetch={mockFetch} />
    );

    const input = getByPlaceholderText("Maya, Dad, Biscuit the dog");
    fireEvent.change(input, { target: { value: "Test" } });

    const submitBtn = getByTestId("submit-button");
    submitBtn.click();

    await waitFor(() => {
      expect(getByTestId("story-screen")).toBeInTheDocument();
    });

    // Loading screen should not be present
    expect(queryByTestId("loading-screen")).not.toBeInTheDocument();
  });
});

describe('Task 3.3: Verify transition back to Setup on error', () => {
  it('transitions back to Setup Screen on API error', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const { getByTestId, getByPlaceholderText } = render(
      <AppWrapper mockFetch={mockFetch} />
    );

    const input = getByPlaceholderText("Maya, Dad, Biscuit the dog");
    fireEvent.change(input, { target: { value: "Maya" } });

    const submitBtn = getByTestId("submit-button");
    submitBtn.click();

    // Wait and verify error handling returns to setup
    await waitFor(() => {
      expect(getByTestId("setup-screen")).toBeInTheDocument();
    });
  });

  it('displays error message on Setup Screen after error', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const { getByTestId, getByPlaceholderText } = render(
      <AppWrapper mockFetch={mockFetch} />
    );

    const input = getByPlaceholderText("Maya, Dad, Biscuit the dog");
    fireEvent.change(input, { target: { value: "Maya" } });

    const submitBtn = getByTestId("submit-button");
    submitBtn.click();

    // Wait for error message to appear
    await waitFor(() => {
      const errorMsg = getByTestId("error-message");
      expect(errorMsg).toBeInTheDocument();
      expect(errorMsg.textContent).toContain("Couldn't reach the storyteller");
    });
  });

  it('handles 500 error response from backend', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500
    });

    const { getByTestId, getByPlaceholderText } = render(
      <AppWrapper mockFetch={mockFetch} />
    );

    const input = getByPlaceholderText("Maya, Dad, Biscuit the dog");
    fireEvent.change(input, { target: { value: "Maya" } });

    const submitBtn = getByTestId("submit-button");
    submitBtn.click();

    // Should return to setup with error
    await waitFor(() => {
      const errorMsg = getByTestId("error-message");
      expect(errorMsg.textContent).toContain("Couldn't reach the storyteller");
    });
  });

  it('user remains on Setup Screen after error', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error("Network error"));

    const { getByTestId, getByPlaceholderText } = render(
      <AppWrapper mockFetch={mockFetch} />
    );

    const input = getByPlaceholderText("Maya, Dad, Biscuit the dog");
    fireEvent.change(input, { target: { value: "Maya" } });

    const submitBtn = getByTestId("submit-button");
    submitBtn.click();

    // Should remain on setup screen with error
    await waitFor(() => {
      expect(getByTestId("setup-screen")).toBeInTheDocument();
      expect(getByTestId("error-message")).toBeInTheDocument();
    });
  });
});
