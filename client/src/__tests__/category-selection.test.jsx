import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SetupScreen from "../components/SetupScreen";
import { THEME_CATEGORIES } from "../constants/themes";

describe("Category / Collection Selection", () => {
  const defaultProps = {
    names: "",
    setNames: jest.fn(),
    themeIndex: 0,
    setThemeIndex: jest.fn(),
    categories: THEME_CATEGORIES,
    themes: THEME_CATEGORIES[0].themes,
    onSubmit: jest.fn(),
  };

  it("shows the non-default collection as selected when category prop is set to it", () => {
    render(
      <SetupScreen
        {...defaultProps}
        category="nature"
        setCategory={jest.fn()}
      />
    );

    const adventuresTab = screen.getByTestId("category-tab-adventures");
    const natureTab = screen.getByTestId("category-tab-nature");

    expect(natureTab).toHaveAttribute("aria-selected", "true");
    expect(adventuresTab).toHaveAttribute("aria-selected", "false");
    expect(natureTab.className).toContain("text-lamp");
    expect(natureTab.className).toContain("border-lamp");
    expect(adventuresTab.className).toContain("border-transparent");
  });

  it("navigating focus to another collection tab selects it and resets themeIndex", () => {
    const setCategoryMock = jest.fn();
    const setThemeIndexMock = jest.fn();

    render(
      <SetupScreen
        {...defaultProps}
        category="adventures"
        setCategory={setCategoryMock}
        setThemeIndex={setThemeIndexMock}
      />
    );

    const bibleTab = screen.getByTestId("category-tab-bible");

    // Navigating focus to Bible Stories tab immediately selects Bible Stories
    fireEvent.focus(bibleTab);
    expect(setCategoryMock).toHaveBeenCalledWith("bible");
    expect(setThemeIndexMock).toHaveBeenCalledWith(0);
  });

  it("focusing the currently active tab does not re-trigger category switch", () => {
    const setCategoryMock = jest.fn();

    render(
      <SetupScreen
        {...defaultProps}
        category="bible"
        setCategory={setCategoryMock}
      />
    );

    const bibleTab = screen.getByTestId("category-tab-bible");

    fireEvent.focus(bibleTab);
    expect(setCategoryMock).not.toHaveBeenCalled();
  });

  it("clicking another collection triggers setCategory with that collection id", () => {
    const setCategoryMock = jest.fn();
    const setThemeIndexMock = jest.fn();

    render(
      <SetupScreen
        {...defaultProps}
        category="adventures"
        setCategory={setCategoryMock}
        setThemeIndex={setThemeIndexMock}
      />
    );

    const fablesTab = screen.getByTestId("category-tab-fables");
    fireEvent.click(fablesTab);

    expect(setCategoryMock).toHaveBeenCalledWith("fables");
    expect(setThemeIndexMock).toHaveBeenCalledWith(0);
  });

  it("navigates left and right with Fire TV keycodes (37, 39) and updates selection", () => {
    const setCategoryMock = jest.fn();
    const setThemeIndexMock = jest.fn();

    render(
      <SetupScreen
        {...defaultProps}
        category="nature"
        setCategory={setCategoryMock}
        setThemeIndex={setThemeIndexMock}
      />
    );

    const natureTab = screen.getByTestId("category-tab-nature");

    // Press Fire TV Left arrow (keyCode 37) on Nature tab -> moves to Fables
    fireEvent.keyDown(natureTab, { key: "Left", keyCode: 37 });
    expect(setCategoryMock).toHaveBeenCalledWith("fables");
    expect(setThemeIndexMock).toHaveBeenCalledWith(0);

    // Press Fire TV Right arrow (keyCode 39) on Nature tab -> moves to Science (Little Explorers)
    fireEvent.keyDown(natureTab, { key: "Right", keyCode: 39 });
    expect(setCategoryMock).toHaveBeenCalledWith("science");
  });
});
