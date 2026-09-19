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
  };

  it("renders all three length options with 6 selected by default", () => {
    render(<SettingsScreen {...defaultProps} storyLength={6} />);
    const shortBtn = screen.getByRole("button", { name: "Short (4p)" });
    const standardBtn = screen.getByRole("button", { name: "Standard (6p)" });
    const longBtn = screen.getByRole("button", { name: "Long (8p)" });

    expect(shortBtn).toBeInTheDocument();
    expect(standardBtn).toBeInTheDocument();
    expect(longBtn).toBeInTheDocument();

    expect(standardBtn).toHaveAttribute("aria-pressed", "true");
    expect(shortBtn).toHaveAttribute("aria-pressed", "false");
    expect(longBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("calls setStoryLength with correct length when buttons are clicked", () => {
    const setStoryLength = jest.fn();
    render(<SettingsScreen {...defaultProps} setStoryLength={setStoryLength} />);

    fireEvent.click(screen.getByRole("button", { name: "Short (4p)" }));
    expect(setStoryLength).toHaveBeenCalledWith(4);

    fireEvent.click(screen.getByRole("button", { name: "Long (8p)" }));
    expect(setStoryLength).toHaveBeenCalledWith(8);

    fireEvent.click(screen.getByRole("button", { name: "Standard (6p)" }));
    expect(setStoryLength).toHaveBeenCalledWith(6);
  });
});
