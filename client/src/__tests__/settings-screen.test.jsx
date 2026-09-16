import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import SettingsScreen from "../components/SettingsScreen";
import { StorageService } from "../utils/storage";
import { PARENT_SETTINGS_KEY } from "../utils/parentSettings";
import { ANALYTICS_STORAGE_KEY } from "../utils/analytics";

describe("SettingsScreen component (Task 15.2 & 20.2)", () => {
  beforeEach(() => {
    StorageService.removeItem(PARENT_SETTINGS_KEY);
    StorageService.removeItem(ANALYTICS_STORAGE_KEY);
  });

  afterEach(() => {
    StorageService.removeItem(PARENT_SETTINGS_KEY);
    StorageService.removeItem(ANALYTICS_STORAGE_KEY);
  });

  it("renders Create PIN form when no PIN is set", () => {
    render(<SettingsScreen onBack={jest.fn()} />);
    expect(screen.getByText("Create a 4-Digit Parent PIN")).toBeInTheDocument();
    expect(screen.getByText("Enter 4-Digit PIN")).toBeInTheDocument();
    expect(screen.getByText("Confirm PIN")).toBeInTheDocument();
  });

  it("shows error if PINs do not match", async () => {
    render(<SettingsScreen onBack={jest.fn()} />);
    const inputs = screen.getAllByPlaceholderText("••••");
    fireEvent.change(inputs[0], { target: { value: "1234" } });
    fireEvent.change(inputs[1], { target: { value: "5678" } });

    const saveBtn = screen.getByRole("button", { name: "Save PIN" });
    fireEvent.click(saveBtn);

    expect(screen.getByText("PINs do not match")).toBeInTheDocument();
  });

  it("unlocks settings panel when PIN is created successfully", async () => {
    render(<SettingsScreen onBack={jest.fn()} />);
    const inputs = screen.getAllByPlaceholderText("••••");
    fireEvent.change(inputs[0], { target: { value: "1234" } });
    fireEvent.change(inputs[1], { target: { value: "1234" } });

    const saveBtn = screen.getByRole("button", { name: "Save PIN" });
    fireEvent.click(saveBtn);

    // Should reveal settings panel
    expect(screen.getByText("Content & Feature Preferences")).toBeInTheDocument();
    expect(screen.getByLabelText("Allow Custom Themes")).toBeInTheDocument();
    expect(screen.getByLabelText("Allow Story History")).toBeInTheDocument();
  });

  it("prompts for PIN entry when PIN exists, and rejects wrong PIN", async () => {
    // Setup stored PIN
    StorageService.setItem(PARENT_SETTINGS_KEY, {
      pinHash: btoa("1234fsn-salt"),
      settings: {
        allowCustomThemes: true,
        allowHistory: true,
        defaultVoice: "Joanna",
        ageRestriction: "all",
      },
    });

    render(<SettingsScreen onBack={jest.fn()} />);
    expect(screen.getByText("Enter Parent PIN")).toBeInTheDocument();

    const pinInput = screen.getByPlaceholderText("••••");
    fireEvent.change(pinInput, { target: { value: "9999" } });

    const unlockBtn = screen.getByRole("button", { name: "Unlock Controls" });
    fireEvent.click(unlockBtn);

    expect(screen.getByText("Incorrect PIN")).toBeInTheDocument();

    // Now enter correct PIN
    fireEvent.change(pinInput, { target: { value: "1234" } });
    fireEvent.click(unlockBtn);

    expect(screen.getByText("Content & Feature Preferences")).toBeInTheDocument();
  });

  it("renders analytics stats and supports clearing data (Task 20.2)", () => {
    // Setup stored PIN + verified state
    StorageService.setItem(PARENT_SETTINGS_KEY, {
      pinHash: btoa("1234fsn-salt"),
      settings: {
        allowCustomThemes: true,
        allowHistory: true,
        defaultVoice: "Joanna",
        ageRestriction: "all",
      },
    });
    // Add sample analytics
    StorageService.setItem(ANALYTICS_STORAGE_KEY, {
      events: [
        {
          timestamp: new Date().toISOString(),
          type: "story_generated",
          data: { theme: "magical forest", voice: "Joanna", familyMembers: ["Maya"] },
        },
      ],
      version: 1,
    });

    render(<SettingsScreen onBack={jest.fn()} />);
    const pinInput = screen.getByPlaceholderText("••••");
    fireEvent.change(pinInput, { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock Controls" }));

    // Check stats are rendered
    expect(screen.getByText(/Story Analytics/)).toBeInTheDocument();
    expect(screen.getByText("magical forest")).toBeInTheDocument();

    // Mock window.confirm
    window.confirm = jest.fn(() => true);
    const clearBtn = screen.getByRole("button", { name: "Clear Analytics Data" });
    fireEvent.click(clearBtn);

    expect(window.confirm).toHaveBeenCalled();
    expect(screen.getAllByText("None").length).toBeGreaterThanOrEqual(1);
  });
});
