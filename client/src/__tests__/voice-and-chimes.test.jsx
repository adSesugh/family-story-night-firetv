import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useSpeechRecognition } from "../utils/useSpeechRecognition";
import { playBedtimeLullabyChime } from "../utils/audioChimes";
import SetupScreen from "../components/SetupScreen";

describe("Voice Input & Bedtime Lullaby Chime (Features A & C)", () => {
  describe("useSpeechRecognition hook", () => {
    it("returns isSupported false when SpeechRecognition is not available", () => {
      const originalSR = window.SpeechRecognition;
      const originalWSR = window.webkitSpeechRecognition;
      delete window.SpeechRecognition;
      delete window.webkitSpeechRecognition;

      const { result } = renderHook(() => useSpeechRecognition());
      expect(result.current.isSupported).toBe(false);
      expect(result.current.isListening).toBe(false);

      window.SpeechRecognition = originalSR;
      window.webkitSpeechRecognition = originalWSR;
    });

    it("starts and stops recognition when SpeechRecognition is available", () => {
      const mockStart = jest.fn();
      const mockStop = jest.fn();
      const mockAbort = jest.fn();

      class MockSpeechRecognition {
        constructor() {
          this.start = mockStart;
          this.stop = mockStop;
          this.abort = mockAbort;
        }
      }

      window.webkitSpeechRecognition = MockSpeechRecognition;

      const onResultMock = jest.fn();
      const { result } = renderHook(() =>
        useSpeechRecognition({ onResult: onResultMock })
      );

      expect(result.current.isSupported).toBe(true);

      act(() => {
        result.current.startListening();
      });
      expect(mockStart).toHaveBeenCalled();

      act(() => {
        result.current.stopListening();
      });
      expect(mockStop).toHaveBeenCalled();

      delete window.webkitSpeechRecognition;
    });
  });

  describe("playBedtimeLullabyChime", () => {
    it("plays pentatonic chord sequence without errors when AudioContext is present", () => {
      const mockGain = {
        gain: {
          setValueAtTime: jest.fn(),
          exponentialRampToValueAtTime: jest.fn(),
        },
        connect: jest.fn(),
      };
      const mockOscillator = {
        type: "",
        frequency: { setValueAtTime: jest.fn() },
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
      };

      const mockAudioCtx = {
        currentTime: 0,
        destination: {},
        createGain: jest.fn(() => ({ ...mockGain })),
        createOscillator: jest.fn(() => ({ ...mockOscillator })),
        state: "running",
      };

      window.AudioContext = jest.fn(() => mockAudioCtx);

      expect(() => {
        playBedtimeLullabyChime();
      }).not.toThrow();

      expect(mockAudioCtx.createOscillator).toHaveBeenCalled();
      delete window.AudioContext;
    });

    it("gracefully ignores call if AudioContext is unsupported", () => {
      const originalAudioCtx = window.AudioContext;
      const originalWebkitCtx = window.webkitAudioContext;
      delete window.AudioContext;
      delete window.webkitAudioContext;

      expect(() => {
        playBedtimeLullabyChime();
      }).not.toThrow();

      window.AudioContext = originalAudioCtx;
      window.webkitAudioContext = originalWebkitCtx;
    });
  });

  describe("SetupScreen Voice Input Integration", () => {
    it("renders microphone voice button when SpeechRecognition is supported", () => {
      class MockSpeechRecognition {
        start() {}
        stop() {}
        abort() {}
      }
      window.webkitSpeechRecognition = MockSpeechRecognition;

      render(
        <SetupScreen
          names=""
          setNames={jest.fn()}
          themeIndex={0}
          setThemeIndex={jest.fn()}
          themes={["Enchanted Forest", "Space Odyssey"]}
        />
      );

      const micBtn = screen.getByRole("button", { name: /speak names into remote/i });
      expect(micBtn).toBeInTheDocument();

      delete window.webkitSpeechRecognition;
    });
  });
});
