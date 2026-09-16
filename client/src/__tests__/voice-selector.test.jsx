import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import SettingsScreen from "../components/SettingsScreen";
import { VOICES } from "../constants/voices";

describe("Voice selector UI in SettingsScreen (Task 8.2 / Req 3.1, 3.2)", () => {
  const defaultProps = {
    onBack: jest.fn(),
    voice: "Joanna",
    setVoice: jest.fn(),
  };

  it("renders all voice options in the select dropdown", () => {
    render(<SettingsScreen {...defaultProps} />);
    const select = screen.getByLabelText("Narrator Voice");
    expect(select).toBeInTheDocument();

    VOICES.forEach((voice) => {
      expect(screen.getByRole("option", { name: voice.name })).toBeInTheDocument();
    });
  });

  it("has Joanna selected by default", () => {
    render(<SettingsScreen {...defaultProps} voice="Joanna" />);
    const select = screen.getByLabelText("Narrator Voice");
    expect(select.value).toBe("Joanna");
  });

  it("calls setVoice with selected voice id when changed", () => {
    const setVoice = jest.fn();
    render(<SettingsScreen {...defaultProps} setVoice={setVoice} />);
    const select = screen.getByLabelText("Narrator Voice");

    fireEvent.change(select, { target: { value: "Matthew" } });
    expect(setVoice).toHaveBeenCalledWith("Matthew");
  });
});
