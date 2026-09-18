import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import HistoryScreen from "../components/HistoryScreen";
import * as storyHistory from "../utils/storyHistory";

// Mock storyHistory module preserving isBiblicalStory
jest.mock("../utils/storyHistory", () => {
  const actual = jest.requireActual("../utils/storyHistory");
  return {
    ...actual,
    loadHistory: jest.fn(),
    deleteStory: jest.fn(),
    clearHistory: jest.fn(),
    saveStory: jest.fn(),
  };
});

// Mock IntersectionObserver
let observerCallback = null;
global.IntersectionObserver = class {
  constructor(callback) {
    observerCallback = callback;
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("HistoryScreen Full-Screen Grid & Infinite Scroll", () => {
  const sampleStories = Array.from({ length: 14 }, (_, i) => ({
    id: `story-${i + 1}`,
    generatedAt: new Date(Date.now() - i * 3600000).toISOString(),
    familyMembers: i % 2 === 0 ? ["Maya", "Dad"] : [],
    theme: i % 3 === 0 ? `Noah's Ark part ${i + 1}` : `Enchanted Forest part ${i + 1}`,
    category: i % 3 === 0 ? "bible" : "adventures",
    firstPage: `Once upon a time in adventure ${i + 1}, the stars glowed softly.`,
    pages: [`Page 1 of ${i + 1}`, `Page 2 of ${i + 1}`],
    illustrations: i % 2 === 0 ? [`data:image/png;base64,fake-cover-${i}`] : [],
    lesson: `Lesson ${i + 1}: Kindness shines in the dark.`,
    chapter: 1,
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
  });

  it("renders empty state with CTA when no stories are stored", () => {
    storyHistory.loadHistory.mockReturnValue([]);

    const onBack = jest.fn();
    render(<HistoryScreen onSelect={jest.fn()} onBack={onBack} />);

    expect(screen.getByText(/No stories written yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start Tonight’s First Story/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Start Tonight’s First Story/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders initial batch of 8 cards in grid for infinite scroll", () => {
    storyHistory.loadHistory.mockReturnValue(sampleStories);

    render(<HistoryScreen onSelect={jest.fn()} onBack={jest.fn()} />);

    // Total story count badge
    expect(screen.getByText("14 stories")).toBeInTheDocument();

    // Only first 8 should be rendered initially
    const cards = screen.getAllByTestId(/^history-card-/);
    expect(cards).toHaveLength(8);

    // Scroll sentinel should be present
    expect(screen.getByTestId("scroll-sentinel")).toBeInTheDocument();
  });

  it("loads more stories when container is scrolled (infinite scroll fallback)", () => {
    storyHistory.loadHistory.mockReturnValue(sampleStories);

    const { container } = render(<HistoryScreen onSelect={jest.fn()} onBack={jest.fn()} />);

    expect(screen.getAllByTestId(/^history-card-/)).toHaveLength(8);

    // Find scrollable container and fire scroll event near bottom
    const scrollContainer = container.querySelector(".overflow-y-auto");
    expect(scrollContainer).toBeInTheDocument();

    Object.defineProperty(scrollContainer, "scrollTop", { value: 600, writable: true });
    Object.defineProperty(scrollContainer, "scrollHeight", { value: 1000, writable: true });
    Object.defineProperty(scrollContainer, "clientHeight", { value: 500, writable: true });

    fireEvent.scroll(scrollContainer);

    // Now all 14 should be visible
    expect(screen.getAllByTestId(/^history-card-/)).toHaveLength(14);
    // Sentinel disappears and end message appears
    expect(screen.queryByTestId("scroll-sentinel")).not.toBeInTheDocument();
    expect(screen.getByText(/You’ve reached the beginning of your bedtime memories/i)).toBeInTheDocument();
  });

  it("filters stories by category tab", () => {
    storyHistory.loadHistory.mockReturnValue(sampleStories);

    render(<HistoryScreen onSelect={jest.fn()} onBack={jest.fn()} />);

    // Click Bible Stories tab
    const bibleTab = screen.getByRole("tab", { name: /Bible Stories/i });
    fireEvent.click(bibleTab);

    // Verify only bible stories are shown
    const bibleCards = screen.getAllByTestId(/^history-card-/);
    const totalBibleStories = sampleStories.filter((s) => s.category === "bible").length;
    expect(bibleCards).toHaveLength(totalBibleStories);

    // Click Adventures tab
    const adventuresTab = screen.getByRole("tab", { name: /Adventures/i });
    fireEvent.click(adventuresTab);
    const adventureCards = screen.getAllByTestId(/^history-card-/);
    expect(adventureCards.length).toBeGreaterThan(0);
  });

  it("clicking a story card invokes onSelect with the full story object", () => {
    storyHistory.loadHistory.mockReturnValue([sampleStories[0]]);

    const onSelect = jest.fn();
    render(<HistoryScreen onSelect={onSelect} onBack={jest.fn()} />);

    const card = screen.getByTestId("history-card-story-1");
    fireEvent.click(card);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(sampleStories[0]);
  });

  it("pressing Enter key on a story card triggers selection (remote / keyboard access)", () => {
    storyHistory.loadHistory.mockReturnValue([sampleStories[0]]);

    const onSelect = jest.fn();
    render(<HistoryScreen onSelect={onSelect} onBack={jest.fn()} />);

    const card = screen.getByTestId("history-card-story-1");
    fireEvent.keyDown(card, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(sampleStories[0]);
  });

  it("clicking delete button on a card opens confirmation modal and deletes that specific story", () => {
    storyHistory.loadHistory.mockReturnValue([sampleStories[0], sampleStories[1]]);

    render(<HistoryScreen onSelect={jest.fn()} onBack={jest.fn()} />);

    const deleteBtns = screen.getAllByTitle("Delete story");
    fireEvent.click(deleteBtns[0]);

    // Better confirmation modal is displayed instead of window.confirm
    expect(screen.getByText("Delete Bedtime Story?")).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: "Delete Story" });
    fireEvent.click(confirmBtn);

    expect(storyHistory.deleteStory).toHaveBeenCalledWith("story-1");
    expect(screen.getByText("Bedtime story removed from your bookshelf")).toBeInTheDocument();
  });

  it("clicking Clear All opens confirmation modal and calls clearHistory", () => {
    storyHistory.loadHistory.mockReturnValue([sampleStories[0]]);

    render(<HistoryScreen onSelect={jest.fn()} onBack={jest.fn()} />);

    const clearBtn = screen.getByRole("button", { name: /Clear All/i });
    fireEvent.click(clearBtn);

    // Better confirmation modal is displayed instead of window.confirm
    expect(screen.getByText("Clear Entire Bookshelf?")).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: "Clear All" });
    fireEvent.click(confirmBtn);

    expect(storyHistory.clearHistory).toHaveBeenCalledTimes(1);
    expect(screen.getByText("All saved bedtime stories cleared")).toBeInTheDocument();
  });
});
