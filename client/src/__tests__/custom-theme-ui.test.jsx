import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import SettingsScreen from "../components/SettingsScreen";
import SetupScreen from "../components/SetupScreen";

/**
 * Unit tests for custom theme UI in SettingsScreen and submission
 * Validates: Requirements 2.1, 2.2
 */

describe("SettingsScreen custom theme UI (Req 2.1, 2.2)", () => {
  const defaultSettingsProps = {
    onBack: jest.fn(),
    themes: ["Forest Adventure", "Ocean Mystery", "Space Quest"],
    themeIndex: 0,
    setThemeIndex: jest.fn(),
    themeMode: "preset",
    setThemeMode: jest.fn(),
    customTheme: "",
    setCustomTheme: jest.fn(),
  };

  const defaultSetupProps = {
    names: "Maya, Dad",
    setNames: jest.fn(),
    themeIndex: 0,
    onSubmit: jest.fn(),
    themes: ["Forest Adventure", "Ocean Mystery", "Space Quest"],
    hasHistory: false,
    onViewHistory: jest.fn(),
    themeMode: "preset",
    customTheme: "",
  };

  describe("Theme mode toggle buttons (Req 2.1)", () => {
    it("renders Preset and Custom toggle buttons", () => {
      render(<SettingsScreen {...defaultSettingsProps} />);
      expect(screen.getByRole("button", { name: "Preset" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();
    });

    it("highlights Preset button when themeMode is 'preset'", () => {
      render(<SettingsScreen {...defaultSettingsProps} themeMode="preset" />);
      const presetButton = screen.getByRole("button", { name: "Preset" });
      expect(presetButton).toHaveClass("bg-lamp");
    });

    it("highlights Custom button when themeMode is 'custom'", () => {
      render(<SettingsScreen {...defaultSettingsProps} themeMode="custom" />);
      const customButton = screen.getByRole("button", { name: "Custom" });
      expect(customButton).toHaveClass("bg-lamp");
    });

    it("calls setThemeMode when Preset button is clicked", async () => {
      const setThemeMode = jest.fn();
      render(<SettingsScreen {...defaultSettingsProps} setThemeMode={setThemeMode} themeMode="custom" />);
      const presetButton = screen.getByRole("button", { name: "Preset" });
      await userEvent.click(presetButton);
      expect(setThemeMode).toHaveBeenCalledWith("preset");
    });

    it("calls setThemeMode when Custom button is clicked", async () => {
      const setThemeMode = jest.fn();
      render(<SettingsScreen {...defaultSettingsProps} setThemeMode={setThemeMode} themeMode="preset" />);
      const customButton = screen.getByRole("button", { name: "Custom" });
      await userEvent.click(customButton);
      expect(setThemeMode).toHaveBeenCalledWith("custom");
    });
  });

  describe("Preset theme options in Settings", () => {
    it("displays preset theme pills when themeMode is 'preset'", () => {
      render(<SettingsScreen {...defaultSettingsProps} themeMode="preset" />);
      expect(screen.getByRole("button", { name: "Forest Adventure" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Ocean Mystery" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Space Quest" })).toBeInTheDocument();
    });

    it("hides preset theme pills when themeMode is 'custom'", () => {
      render(<SettingsScreen {...defaultSettingsProps} themeMode="custom" />);
      expect(screen.queryByRole("button", { name: "Forest Adventure" })).not.toBeInTheDocument();
    });

    it("highlights current active preset theme", () => {
      render(<SettingsScreen {...defaultSettingsProps} themeMode="preset" themeIndex={1} />);
      const activePill = screen.getByRole("button", { name: "Ocean Mystery" });
      expect(activePill).toHaveClass("bg-lamp");
    });

    it("calls setThemeIndex when a preset pill is clicked", async () => {
      const setThemeIndex = jest.fn();
      render(
        <SettingsScreen
          {...defaultSettingsProps}
          themeMode="preset"
          setThemeIndex={setThemeIndex}
        />
      );
      const pill = screen.getByRole("button", { name: "Space Quest" });
      await userEvent.click(pill);
      expect(setThemeIndex).toHaveBeenCalledWith(2);
    });
  });

  describe("Custom theme textarea (Req 2.2)", () => {
    it("displays textarea when themeMode is 'custom'", () => {
      render(<SettingsScreen {...defaultSettingsProps} themeMode="custom" />);
      const textarea = screen.getByPlaceholderText("Describe your custom story theme...");
      expect(textarea).toBeInTheDocument();
    });

    it("hides textarea when themeMode is 'preset'", () => {
      render(<SettingsScreen {...defaultSettingsProps} themeMode="preset" />);
      const textarea = screen.queryByPlaceholderText("Describe your custom story theme...");
      expect(textarea).not.toBeInTheDocument();
    });

    it("displays the customTheme value in the textarea", () => {
      const customTheme = "a spooky haunted house adventure";
      render(
        <SettingsScreen {...defaultSettingsProps} themeMode="custom" customTheme={customTheme} />
      );
      const textarea = screen.getByPlaceholderText("Describe your custom story theme...");
      expect(textarea).toHaveValue(customTheme);
    });

    it("calls setCustomTheme when textarea content changes", async () => {
      const setCustomTheme = jest.fn();
      render(
        <SettingsScreen {...defaultSettingsProps} themeMode="custom" setCustomTheme={setCustomTheme} />
      );
      const textarea = screen.getByPlaceholderText("Describe your custom story theme...");
      await userEvent.type(textarea, "a magical forest");
      expect(setCustomTheme).toHaveBeenCalled();
    });
  });

  describe("Character counter increments correctly (Req 2.2)", () => {
    it("displays character counter with format 'X / 100'", () => {
      render(
        <SettingsScreen
          {...defaultSettingsProps}
          themeMode="custom"
          customTheme="hello"
        />
      );
      expect(screen.getByText("5 / 100")).toBeInTheDocument();
    });

    it("starts at 0 / 100 when customTheme is empty", () => {
      render(<SettingsScreen {...defaultSettingsProps} themeMode="custom" customTheme="" />);
      expect(screen.getByText("0 / 100")).toBeInTheDocument();
    });

    it("increments to 50 / 100 when customTheme has 50 characters", () => {
      const text = "a".repeat(50);
      render(
        <SettingsScreen {...defaultSettingsProps} themeMode="custom" customTheme={text} />
      );
      expect(screen.getByText("50 / 100")).toBeInTheDocument();
    });

    it("maxes out at 100 / 100 when customTheme has 100 characters", () => {
      const text = "a".repeat(100);
      render(
        <SettingsScreen {...defaultSettingsProps} themeMode="custom" customTheme={text} />
      );
      expect(screen.getByText("100 / 100")).toBeInTheDocument();
    });

    it("does not display character counter in preset mode", () => {
      render(<SettingsScreen {...defaultSettingsProps} themeMode="preset" />);
      expect(screen.queryByText(/\d+ \/ 100/)).not.toBeInTheDocument();
    });
  });

  describe("Custom theme validation and SetupScreen behavior", () => {
    it("displays error when customThemeError prop is set", () => {
      render(
        <SetupScreen
          {...defaultSetupProps}
          themeMode="custom"
          customTheme=""
          customThemeError="Custom theme cannot be empty"
        />
      );
      expect(screen.getByText("Custom theme cannot be empty")).toBeInTheDocument();
    });

    it("calls onSubmit when 'Begin the story' button is clicked", async () => {
      const onSubmit = jest.fn();
      render(<SetupScreen {...defaultSetupProps} onSubmit={onSubmit} />);
      const submitButton = screen.getByRole("button", { name: "Begin the story" });
      await userEvent.click(submitButton);
      expect(onSubmit).toHaveBeenCalled();
    });

    it("displays View History button when hasHistory is true", () => {
      render(<SetupScreen {...defaultSetupProps} hasHistory={true} />);
      expect(screen.getByRole("button", { name: /View History/ })).toBeInTheDocument();
    });

    it("hides View History button when hasHistory is false", () => {
      render(<SetupScreen {...defaultSetupProps} hasHistory={false} />);
      expect(screen.queryByRole("button", { name: /View History/ })).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("renders toggle buttons with aria-pressed attribute", () => {
      render(<SettingsScreen {...defaultSettingsProps} themeMode="preset" />);
      const presetBtn = screen.getByRole("button", { name: "Preset" });
      const customBtn = screen.getByRole("button", { name: "Custom" });
      expect(presetBtn).toHaveAttribute("aria-pressed", "true");
      expect(customBtn).toHaveAttribute("aria-pressed", "false");
    });

    it("textarea has placeholder for guidance", () => {
      render(<SettingsScreen {...defaultSettingsProps} themeMode="custom" />);
      const textarea = screen.getByPlaceholderText("Describe your custom story theme...");
      expect(textarea).toBeInTheDocument();
    });
  });
});
