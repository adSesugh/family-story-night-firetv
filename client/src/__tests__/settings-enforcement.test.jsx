import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import SetupScreen from "../components/SetupScreen";
import SettingsScreen from "../components/SettingsScreen";
import { StorageService } from "../utils/storage";
import { PARENT_SETTINGS_KEY } from "../utils/parentSettings";

describe("Parent Settings Enforcement (Task 16.3 / Req 6.3, 6.4)", () => {
  const baseProps = {
    names: "Maya, Dad",
    setNames: jest.fn(),
    themeIndex: 0,
    setThemeIndex: jest.fn(),
    error: null,
    onSubmit: jest.fn(),
    themes: ["Forest Adventure", "Space Quest"],
    hasHistory: true,
    onViewHistory: jest.fn(),
    onOpenSettings: jest.fn(),
  };

  beforeEach(() => {
    StorageService.removeItem(PARENT_SETTINGS_KEY);
  });

  afterEach(() => {
    StorageService.removeItem(PARENT_SETTINGS_KEY);
  });

  it("hides custom theme toggle in SettingsScreen when allowCustomThemes is false", () => {
    StorageService.setItem(PARENT_SETTINGS_KEY, {
      pinHash: btoa("1234fsn-salt"),
      settings: {
        allowCustomThemes: false,
        allowHistory: true,
      },
    });

    render(<SettingsScreen onBack={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Preset" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Custom" })).not.toBeInTheDocument();
  });

  it("shows custom theme toggle in SettingsScreen when allowCustomThemes is true", () => {
    StorageService.setItem(PARENT_SETTINGS_KEY, {
      pinHash: btoa("1234fsn-salt"),
      settings: {
        allowCustomThemes: true,
        allowHistory: true,
      },
    });

    render(<SettingsScreen onBack={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Preset" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
  });

  it("hides View History button when allowHistory is false even if hasHistory is true", () => {
    const parentSettings = {
      pinHash: "hash",
      settings: {
        allowCustomThemes: true,
        allowHistory: false,
      },
    };

    render(<SetupScreen {...baseProps} hasHistory={true} parentSettings={parentSettings} />);
    expect(screen.queryByRole("button", { name: /View History/ })).not.toBeInTheDocument();
  });

  it("shows View History button when allowHistory is true and hasHistory is true", () => {
    const parentSettings = {
      pinHash: "hash",
      settings: {
        allowCustomThemes: true,
        allowHistory: true,
      },
    };

    render(<SetupScreen {...baseProps} hasHistory={true} parentSettings={parentSettings} />);
    expect(screen.getByRole("button", { name: /View History/ })).toBeInTheDocument();
  });

  it("calls onOpenSettings when Settings button is clicked", () => {
    const onOpenSettings = jest.fn();
    render(<SetupScreen {...baseProps} onOpenSettings={onOpenSettings} />);
    const btn = screen.getByRole("button", { name: "Parent Settings" });
    fireEvent.click(btn);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
