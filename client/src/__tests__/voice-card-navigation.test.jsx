import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import VoiceSelector from "../components/VoiceSelector";
import { moveFocus, getFocusableElements } from "../utils/spatialNav";
import { VOICES } from "../constants/voices";

describe("VoiceSelector D-Pad Navigation and Card Priority", () => {
  it("voice cards are focusable targets while preview buttons have tabindex -1", () => {
    render(<VoiceSelector value="Joanna" onChange={jest.fn()} variant="cards" voices={VOICES} />);

    const joannaCard = screen.getByTestId("voice-card-Joanna");
    const matthewCard = screen.getByTestId("voice-card-Matthew");

    // Cards should be primary focusable targets
    expect(joannaCard).toHaveAttribute("tabindex", "0");
    expect(matthewCard).toHaveAttribute("tabindex", "0");

    // Preview buttons should not intercept spatial navigation
    const previewButtons = Array.from(screen.getByTestId("voice-card-Joanna").parentElement.querySelectorAll("button[aria-label*='Preview']"));
    expect(previewButtons.length).toBeGreaterThan(0);
    previewButtons.forEach((btn) => {
      expect(btn).toHaveAttribute("tabindex", "-1");
      expect(btn).toHaveAttribute("data-no-focus-ring");
    });
  });

  it("getFocusableElements only includes voice cards and excludes preview buttons", () => {
    const { container } = render(
      <VoiceSelector value="Joanna" onChange={jest.fn()} variant="cards" voices={VOICES} />
    );

    const focusable = getFocusableElements(container);

    // Should include the cards and record button, not the preview buttons
    const previewButtons = Array.from(container.querySelectorAll("button[aria-label*='Preview']"));
    expect(previewButtons.length).toBeGreaterThan(0);
    previewButtons.forEach((btn) => {
      expect(focusable).not.toContain(btn);
    });

    const joannaCard = screen.getByTestId("voice-card-Joanna");
    expect(focusable).toContain(joannaCard);
  });

  it("triggers selection when voice card is clicked or activated with Enter", () => {
    const onChange = jest.fn();
    render(<VoiceSelector value="Joanna" onChange={onChange} variant="cards" voices={VOICES} />);

    const matthewCard = screen.getByTestId("voice-card-Matthew");

    // Activate via Enter key (D-pad Select)
    fireEvent.keyDown(matthewCard, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("Matthew");

    // Activate via Click
    const emmaCard = screen.getByTestId("voice-card-Emma");
    fireEvent.click(emmaCard);
    expect(onChange).toHaveBeenCalledWith("Emma");
  });
});
