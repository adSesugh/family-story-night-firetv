import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SetupScreen from "../components/SetupScreen";
import { THEME_CATEGORIES } from "../constants/themes";

describe("SetupScreen D-pad Navigation on All Actions", () => {
  const defaultProps = {
    names: "Leo, Maya",
    setNames: jest.fn(),
    themeIndex: 0,
    setThemeIndex: jest.fn(),
    category: "adventures",
    setCategory: jest.fn(),
    categories: THEME_CATEGORIES,
    themes: ["a cozy space adventure", "a friendly ocean voyage", "a magical garden"],
    onSubmit: jest.fn(),
    hasHistory: true,
    onViewHistory: jest.fn(),
    onOpenSettings: jest.fn(),
    storyLength: 6,
    setStoryLength: jest.fn(),
    voice: "Joanna",
    setVoice: jest.fn(),
  };

  it("navigates down from names input to active category tab and then to theme controls", () => {
    render(<SetupScreen {...defaultProps} />);

    const input = screen.getByPlaceholderText(/Maya, Dad, Biscuit the dog/i);
    input.focus();
    expect(document.activeElement).toBe(input);

    // Press ArrowDown from names input -> moves to active category tab
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const activeTab = screen.getByTestId("category-tab-adventures");
    expect(document.activeElement).toBe(activeTab);

    // Press ArrowDown from category tab -> moves to theme controls
    fireEvent.keyDown(activeTab, { key: "ArrowDown" });
    const prevThemeBtn = screen.getByRole("button", { name: /previous story theme/i });
    expect(document.activeElement).toBe(prevThemeBtn);
  });

  it("navigates up from names input to settings button", () => {
    render(<SetupScreen {...defaultProps} />);

    const input = screen.getByPlaceholderText(/Maya, Dad, Biscuit the dog/i);
    input.focus();

    fireEvent.keyDown(input, { key: "ArrowUp" });
    const settingsBtn = screen.getByRole("button", { name: /parent settings/i });
    expect(document.activeElement).toBe(settingsBtn);

    // Press ArrowDown from settings button -> moves back to names input
    fireEvent.keyDown(settingsBtn, { key: "ArrowDown" });
    expect(document.activeElement).toBe(input);
  });

  it("navigates between category tabs horizontally and auto-selects", () => {
    const setCategory = jest.fn();
    render(<SetupScreen {...defaultProps} setCategory={setCategory} />);

    const tab = screen.getByTestId("category-tab-adventures");
    tab.focus();

    // Press ArrowRight to move to Bible
    fireEvent.keyDown(tab, { key: "ArrowRight" });
    expect(setCategory).toHaveBeenCalledWith("bible");

    // Press ArrowLeft to move to Calm (wrap around)
    fireEvent.keyDown(tab, { key: "ArrowLeft" });
    expect(setCategory).toHaveBeenCalledWith("calm");
  });

  it("cycles theme controls with Left and Right", () => {
    const setThemeIndex = jest.fn();
    render(<SetupScreen {...defaultProps} setThemeIndex={setThemeIndex} />);

    const prevBtn = screen.getByRole("button", { name: /previous story theme/i });
    const nextBtn = screen.getByRole("button", { name: /next story theme/i });

    prevBtn.focus();
    fireEvent.keyDown(prevBtn, { key: "ArrowRight" });
    expect(document.activeElement).toBe(nextBtn);

    fireEvent.keyDown(nextBtn, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(prevBtn);

    fireEvent.click(nextBtn);
    expect(setThemeIndex).toHaveBeenCalled();
  });

  it("navigates from theme controls down to story length and bottom buttons and up back to theme controls", () => {
    render(<SetupScreen {...defaultProps} />);

    const prevBtn = screen.getByRole("button", { name: /previous story theme/i });
    const viewHistoryBtn = screen.getByRole("button", { name: /view history/i });
    const lengthBtn = screen.getByRole("button", { name: /story length: early reader/i });

    prevBtn.focus();
    fireEvent.keyDown(prevBtn, { key: "ArrowDown" });
    expect(document.activeElement).toBe(lengthBtn);

    fireEvent.keyDown(lengthBtn, { key: "ArrowDown" });
    expect(document.activeElement).toBe(viewHistoryBtn);

    fireEvent.keyDown(viewHistoryBtn, { key: "ArrowUp" });
    expect(document.activeElement).toBe(lengthBtn);

    fireEvent.keyDown(lengthBtn, { key: "ArrowUp" });
    expect(document.activeElement).toBe(prevBtn);
  });

  it("navigates bottom buttons (View History <-> Begin the story) with D-pad", () => {
    render(<SetupScreen {...defaultProps} />);

    const viewHistoryBtn = screen.getByRole("button", { name: /view history/i });
    const beginStoryBtn = screen.getByRole("button", { name: /begin the story/i });

    viewHistoryBtn.focus();
    fireEvent.keyDown(viewHistoryBtn, { key: "ArrowRight" });
    expect(document.activeElement).toBe(beginStoryBtn);

    fireEvent.keyDown(beginStoryBtn, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(viewHistoryBtn);
  });
});
