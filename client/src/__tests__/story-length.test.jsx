import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import SettingsScreen from "../components/SettingsScreen";

describe("Story length selector UI in SettingsScreen (Task 10.2 / Req 4.1, 4.5)", () => {
  const defaultProps = {
    onBack: jest.fn(),
    onSettingsChange: jest.fn(),
    storyLength: 6,
    setStoryLength: jest.fn(),
    initialTab: "parent",
    initialUnlocked: true,
  };

  it("does not render story length buttons in Tab 1 (Story Preferences) without parent unlock", () => {
    render(<SettingsScreen {...defaultProps} initialTab="story" initialUnlocked={false} />);
    expect(screen.queryByRole("button", { name: /Toddler/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Chapter Book/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Parental Controls Protected/i)).toBeInTheDocument();
  });

  it("renders all three length options with 6 selected by default", () => {
    render(<SettingsScreen {...defaultProps} storyLength={6} />);
    const toddlerBtn = screen.getByRole("button", { name: /Story Length: Toddler/i });
    const readerBtn = screen.getByRole("button", { name: /Story Length: Early Reader/i });
    const chapterBtn = screen.getByRole("button", { name: /Story Length: Chapter Book/i });

    expect(toddlerBtn).toBeInTheDocument();
    expect(readerBtn).toBeInTheDocument();
    expect(chapterBtn).toBeInTheDocument();

    expect(readerBtn).toHaveAttribute("aria-pressed", "true");
    expect(toddlerBtn).toHaveAttribute("aria-pressed", "false");
    expect(chapterBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("calls setStoryLength with correct length when buttons are clicked", () => {
    const setStoryLength = jest.fn();
    render(<SettingsScreen {...defaultProps} setStoryLength={setStoryLength} />);

    fireEvent.click(screen.getByRole("button", { name: /Story Length: Toddler/i }));
    expect(setStoryLength).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByRole("button", { name: /Story Length: Chapter Book/i }));
    expect(setStoryLength).toHaveBeenCalledWith(9);

    fireEvent.click(screen.getByRole("button", { name: /Story Length: Early Reader/i }));
    expect(setStoryLength).toHaveBeenCalledWith(6);
  });
});
