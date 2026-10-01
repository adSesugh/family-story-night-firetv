import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import SettingsScreen from "../components/SettingsScreen";
import { StorageService } from "../utils/storage";
import { PARENT_SETTINGS_KEY } from "../utils/parentSettings";
import { moveFocus } from "../utils/spatialNav";

describe("SettingsScreen Tab Selection and Focus Synchronization", () => {
  beforeEach(() => {
    StorageService.removeItem(PARENT_SETTINGS_KEY);
    if (document.querySelectorAll) {
      document.querySelectorAll("[data-dpad-focused]").forEach((el) => el.removeAttribute("data-dpad-focused"));
    }
  });

  afterEach(() => {
    StorageService.removeItem(PARENT_SETTINGS_KEY);
  });

  it("shows Story Preferences selected by default and Parent Controls unselected", () => {
    render(<SettingsScreen onBack={jest.fn()} />);

    const storyTab = screen.getByTestId("settings-tab-story");
    const parentTab = screen.getByTestId("settings-tab-parent");

    expect(storyTab).toHaveAttribute("aria-selected", "true");
    expect(parentTab).toHaveAttribute("aria-selected", "false");

    expect(storyTab.className).toContain("border-lamp");
    expect(parentTab.className).toContain("border-transparent");
  });

  it("clicking Parent Controls unselects Story Preferences and removes active border", () => {
    render(<SettingsScreen onBack={jest.fn()} />);

    const storyTab = screen.getByTestId("settings-tab-story");
    const parentTab = screen.getByTestId("settings-tab-parent");

    // Click Parent Controls tab
    fireEvent.click(parentTab);

    expect(parentTab).toHaveAttribute("aria-selected", "true");
    expect(storyTab).toHaveAttribute("aria-selected", "false");

    expect(parentTab.className).toContain("border-lamp");
    expect(storyTab.className).toContain("border-transparent");
    expect(storyTab.className).not.toContain("border-lamp");
  });

  it("focusing Parent Controls tab immediately selects Parent Controls and unselects Story Preferences", () => {
    render(<SettingsScreen onBack={jest.fn()} />);

    const storyTab = screen.getByTestId("settings-tab-story");
    const parentTab = screen.getByTestId("settings-tab-parent");

    // Focus lands on Parent Controls tab (via Tab key or spatial navigation)
    fireEvent.focus(parentTab);

    expect(parentTab).toHaveAttribute("aria-selected", "true");
    expect(storyTab).toHaveAttribute("aria-selected", "false");

    expect(parentTab.className).toContain("border-lamp");
    expect(storyTab.className).toContain("border-transparent");
    expect(storyTab.className).not.toContain("border-lamp");
    expect(storyTab).not.toHaveAttribute("data-dpad-focused");
  });

  it("navigates tabs using Fire TV remote keys (keyCode 37, 39, Left, Right)", () => {
    render(<SettingsScreen onBack={jest.fn()} />);

    const storyTab = screen.getByTestId("settings-tab-story");
    const parentTab = screen.getByTestId("settings-tab-parent");

    // Press Fire TV Right on Story Preferences tab -> moves to and selects Parent Controls
    fireEvent.keyDown(storyTab, { key: "Right", keyCode: 39 });

    expect(parentTab).toHaveAttribute("aria-selected", "true");
    expect(storyTab).toHaveAttribute("aria-selected", "false");
    expect(storyTab.className).toContain("border-transparent");
    expect(parentTab.className).toContain("border-lamp");

    // Press Fire TV Left on Parent Controls tab -> moves back to and selects Story Preferences
    fireEvent.keyDown(parentTab, { key: "Left", keyCode: 37 });

    expect(storyTab).toHaveAttribute("aria-selected", "true");
    expect(parentTab).toHaveAttribute("aria-selected", "false");
    expect(storyTab.className).toContain("border-lamp");
    expect(parentTab.className).toContain("border-transparent");
  });

  it("navigating focus clears lingering data-dpad-focused so unselected tabs never show active focus border", () => {
    render(<SettingsScreen onBack={jest.fn()} />);

    const storyTab = screen.getByTestId("settings-tab-story");
    const parentTab = screen.getByTestId("settings-tab-parent");

    storyTab.setAttribute("data-dpad-focused", "true");

    // Click Parent Controls tab
    fireEvent.click(parentTab);

    // Stale data-dpad-focused should be cleared from Story Preferences tab
    expect(storyTab).not.toHaveAttribute("data-dpad-focused");
  });

  it("pressing ArrowDown on a tab moves focus into the panel rather than flipping tabs", () => {
    render(<SettingsScreen onBack={jest.fn()} />);

    const storyTab = screen.getByTestId("settings-tab-story");
    fireEvent.keyDown(storyTab, { key: "ArrowDown", keyCode: 40 });

    // Story tab remains selected
    expect(storyTab).toHaveAttribute("aria-selected", "true");
  });

  it("tabs have data-no-focus-ring and rounded-none for border-b indicator without rounded pill ring", () => {
    render(<SettingsScreen onBack={jest.fn()} />);

    const storyTab = screen.getByTestId("settings-tab-story");
    const parentTab = screen.getByTestId("settings-tab-parent");

    expect(storyTab).toHaveAttribute("data-no-focus-ring");
    expect(parentTab).toHaveAttribute("data-no-focus-ring");

    expect(storyTab.className).toContain("border-b-2");
    expect(storyTab.className).toContain("rounded-none");
    expect(parentTab.className).toContain("border-b-2");
    expect(parentTab.className).toContain("rounded-none");

    expect(storyTab.style.outline).toBe("none");
    expect(storyTab.style.borderRadius).toBe("0");
  });

  it("navigates from Back button to Tabs on D-pad Down and Left", () => {
    render(<SettingsScreen onBack={jest.fn()} />);

    const backBtn = screen.getByTestId("settings-back-btn");
    const storyTab = screen.getByTestId("settings-tab-story");
    const parentTab = screen.getByTestId("settings-tab-parent");

    backBtn.focus();
    expect(document.activeElement).toBe(backBtn);

    // Press Down on Back button -> should focus active tab (story)
    fireEvent.keyDown(backBtn, { key: "ArrowDown", keyCode: 40 });
    expect(document.activeElement).toBe(storyTab);
    expect(storyTab).toHaveAttribute("data-dpad-focused", "true");

    // Move back to Back button and press Left -> should focus parent tab
    backBtn.focus();
    fireEvent.keyDown(backBtn, { key: "ArrowLeft", keyCode: 37 });
    expect(document.activeElement).toBe(parentTab);
    expect(parentTab).toHaveAttribute("data-dpad-focused", "true");
  });

  it("navigates from Tabs to Back button on D-pad Up and Right from last tab", () => {
    render(<SettingsScreen onBack={jest.fn()} />);

    const backBtn = screen.getByTestId("settings-back-btn");
    const storyTab = screen.getByTestId("settings-tab-story");
    const parentTab = screen.getByTestId("settings-tab-parent");

    // Press Up on Story tab -> focuses Back button
    storyTab.focus();
    fireEvent.keyDown(storyTab, { key: "ArrowUp", keyCode: 38 });
    expect(document.activeElement).toBe(backBtn);
    expect(backBtn).toHaveAttribute("data-dpad-focused", "true");

    // Focus Parent tab and press Up -> focuses Back button
    act(() => {
      parentTab.focus();
    });
    fireEvent.keyDown(parentTab, { key: "ArrowUp", keyCode: 38 });
    expect(document.activeElement).toBe(backBtn);

    // Focus Parent tab and press Right -> focuses Back button
    act(() => {
      parentTab.focus();
    });
    fireEvent.keyDown(parentTab, { key: "ArrowRight", keyCode: 39 });
    expect(document.activeElement).toBe(backBtn);
  });

  it("moveFocus navigates correctly between Back button and Tabs", () => {
    render(<SettingsScreen onBack={jest.fn()} />);

    const backBtn = screen.getByTestId("settings-back-btn");
    const storyTab = screen.getByTestId("settings-tab-story");

    backBtn.focus();
    expect(document.activeElement).toBe(backBtn);

    // Calling moveFocus('down') from Back button moves to active tab, NOT content column
    const movedDown = moveFocus("down");
    expect(movedDown).toBe(true);
    expect(document.activeElement).toBe(storyTab);

    // Calling moveFocus('up') from Tab moves back to Back button
    const movedUp = moveFocus("up");
    expect(movedUp).toBe(true);
    expect(document.activeElement).toBe(backBtn);
  });
});
