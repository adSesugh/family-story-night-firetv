import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
// Mock swiper to avoid ESM syntax issues in Jest
jest.mock("swiper/react", () => ({
  Swiper: ({ children }) => <div data-testid="swiper-mock">{children}</div>,
  SwiperSlide: ({ children }) => <div data-testid="swiper-slide-mock">{children}</div>,
}));
jest.mock("swiper/modules", () => ({
  Keyboard: {},
  Navigation: {},
}));
jest.mock("swiper/css", () => ({}));
jest.mock("swiper/css/navigation", () => ({}));

import { loadCustomVoices, saveCustomVoice, deleteCustomVoice, getCustomVoice } from "../utils/customVoices";
import VoiceSelector from "../components/VoiceSelector";
import FamilyVoiceStudioModal from "../components/FamilyVoiceStudioModal";
import StoryScreen from "../components/StoryScreen";

describe("Personalized Voice Clones (Family Voice Studio)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
    if (typeof global.URL !== "undefined" && !global.URL.createObjectURL) {
      global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
    }
  });

  describe("customVoices utility", () => {
    it("starts with empty custom voices", () => {
      expect(loadCustomVoices()).toEqual([]);
    });

    it("saves and loads custom voice profiles", () => {
      const saved = saveCustomVoice({
        name: "Mom's Bedtime Voice",
        role: "Mom",
        baseVoice: "Joanna",
        audioDataUrl: "data:audio/webm;base64,mockAudioData",
      });

      expect(saved).toBeTruthy();
      expect(saved.id).toMatch(/^custom_/);
      expect(saved.name).toBe("Mom's Bedtime Voice");
      expect(saved.isCustom).toBe(true);
      expect(saved.avatar).toBe("👩");

      const list = loadCustomVoices();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(saved.id);
    });

    it("deletes a custom voice profile", () => {
      const saved1 = saveCustomVoice({ name: "Mom", role: "Mom" });
      const saved2 = saveCustomVoice({ name: "Dad", role: "Dad" });
      expect(loadCustomVoices()).toHaveLength(2);

      const deleted = deleteCustomVoice(saved1.id);
      expect(deleted).toBe(true);

      const updated = loadCustomVoices();
      expect(updated).toHaveLength(1);
      expect(updated[0].id).toBe(saved2.id);
    });
  });

  describe("FamilyVoiceStudioModal component", () => {
    it("renders studio dialog with reading script and controls when open", () => {
      render(
        <FamilyVoiceStudioModal
          isOpen={true}
          onClose={jest.fn()}
          onVoiceCreated={jest.fn()}
        />
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/Family Voice Studio/i)).toBeInTheDocument();
      expect(screen.getByText(/The stars are shining softly tonight/i)).toBeInTheDocument();
      expect(screen.getByTestId("start-recording-btn")).toBeInTheDocument();
      expect(screen.getByTestId("save-voice-clone-btn")).toBeInTheDocument();
    });

    it("updates role and input name when role buttons are clicked", () => {
      render(
        <FamilyVoiceStudioModal
          isOpen={true}
          onClose={jest.fn()}
          onVoiceCreated={jest.fn()}
        />
      );

      const dadBtn = screen.getByRole("button", { name: "Dad" });
      fireEvent.click(dadBtn);

      const input = screen.getByTestId("voice-name-input");
      expect(input.value).toBe("Dad's Bedtime Voice");
    });

    it("saves custom voice and triggers onVoiceCreated", () => {
      const onVoiceCreated = jest.fn();
      const onClose = jest.fn();

      render(
        <FamilyVoiceStudioModal
          isOpen={true}
          onClose={onClose}
          onVoiceCreated={onVoiceCreated}
        />
      );

      const input = screen.getByTestId("voice-name-input");
      fireEvent.change(input, { target: { value: "Grandma Susan" } });

      fireEvent.click(screen.getByTestId("save-voice-clone-btn"));

      expect(onVoiceCreated).toHaveBeenCalled();
      const createdVoice = onVoiceCreated.mock.calls[0][0];
      expect(createdVoice.name).toBe("Grandma Susan");
      expect(onClose).toHaveBeenCalled();
    });

    it("closes modal when Escape or GoBack key is pressed", () => {
      const onClose = jest.fn();
      render(
        <FamilyVoiceStudioModal
          isOpen={true}
          onClose={onClose}
          onVoiceCreated={jest.fn()}
        />
      );

      fireEvent.keyDown(window, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(window, { key: "GoBack" });
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it("focuses interactive element upon open and scopes spatial navigation", async () => {
      const onClose = jest.fn();
      render(
        <FamilyVoiceStudioModal
          isOpen={true}
          onClose={onClose}
          onVoiceCreated={jest.fn()}
        />
      );

      // Wait for the open focus timeout
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(document.activeElement).not.toBeNull();
      expect(document.activeElement.tagName).toMatch(/BUTTON|INPUT/);
    });

    it("supports uploading an audio file and triggers onVoiceCreated with voice data", async () => {
      const onVoiceCreated = jest.fn();
      const onClose = jest.fn();

      render(
        <FamilyVoiceStudioModal
          isOpen={true}
          onClose={onClose}
          onVoiceCreated={onVoiceCreated}
        />
      );

      const fileInput = screen.getByTestId("audio-file-input");
      const mockFile = new File(["dummy-audio-content"], "mom_voice.wav", { type: "audio/wav" });

      fireEvent.change(fileInput, { target: { files: [mockFile] } });

      await waitFor(() => {
        expect(screen.getByText(/Voice sample ready/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("save-voice-clone-btn"));

      await waitFor(() => {
        expect(onVoiceCreated).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe("VoiceSelector with Custom Voices", () => {
    it("displays saved custom voice with Family Voice Clone badge", () => {
      saveCustomVoice({
        name: "Mom's Bedtime Voice",
        role: "Mom",
        baseVoice: "Joanna",
      });

      render(<VoiceSelector value="Joanna" onChange={jest.fn()} variant="cards" />);

      expect(screen.getAllByText("Mom's Bedtime Voice").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Family Voice Clone/i)).toBeInTheDocument();
      expect(screen.getByTestId("record-family-voice-btn")).toBeInTheDocument();
    });

    it("selects custom voice when clicked", () => {
      const saved = saveCustomVoice({
        name: "Dad's Voice",
        role: "Dad",
        baseVoice: "Matthew",
      });

      const onChange = jest.fn();
      render(<VoiceSelector value="Joanna" onChange={onChange} variant="cards" />);

      const dadMatches = screen.getAllByText("Dad's Voice");
      const dadCard = dadMatches.find((el) => el.closest('[role="button"]')).closest('[role="button"]');
      fireEvent.click(dadCard);

      expect(onChange).toHaveBeenCalledWith(saved.id);
    });

    it("opens Family Voice Studio when + Record Loved One's Voice is clicked", () => {
      render(<VoiceSelector value="Joanna" onChange={jest.fn()} variant="cards" />);

      fireEvent.click(screen.getByTestId("record-family-voice-btn"));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText(/Family Voice Studio/i)).toBeInTheDocument();
    });
  });

  describe("StoryScreen with Custom Voices", () => {
    it("renders custom voice greeting button and narrator badge in StoryScreen", () => {
      const saved = saveCustomVoice({
        name: "Mom's Bedtime Voice",
        role: "Mom",
        baseVoice: "Joanna",
        audioDataUrl: "data:audio/webm;base64,mockAudioData",
      });

      render(
        <StoryScreen
          pages={[{ text: "Once upon a time in a faraway forest." }]}
          illustrations={[]}
          pageIndex={0}
          isNarrating={true}
          onToggleNarration={jest.fn()}
          voice={saved.id}
        />
      );

      // Should display custom voice action button for personal voice greeting
      expect(screen.getByText(/Mom's Bedtime Voice's Voice/i)).toBeInTheDocument();
      // Should display reading aloud status with custom voice avatar
      expect(screen.getByText(/Reading aloud/i)).toBeInTheDocument();
      expect(screen.getByText("👩")).toBeInTheDocument();
    });
  });

  describe("Cross-Device Family User ID Sync", () => {
    it("generates and updates persistent user_id for the family", async () => {
      const { getUserId, setUserId } = await import("../utils/device");
      const initialId = getUserId();
      expect(initialId).toBeTruthy();

      const customFamilyId = "family-anderson-42";
      setUserId(customFamilyId);
      expect(getUserId()).toBe(customFamilyId);
    });

    it("hydrates custom voices from server preferences into other children's devices with the same user_id", async () => {
      const { fetchPreferencesFromServer } = await import("../utils/userPreferences");
      const { loadCustomVoices } = await import("../utils/customVoices");

      const mockCustomVoiceFromServer = {
        id: "custom_dad_9999",
        name: "Dad's Voice",
        role: "Dad",
        baseVoice: "Matthew",
        audioDataUrl: "data:audio/wav;base64,mockDadWav",
        isCustom: true,
      };

      // Mock server response returning custom voice for this family
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          preferences: {
            deviceId: "child-firetv-2",
            userId: "family-anderson-42",
            voiceId: "custom_dad_9999",
            storyLength: 6,
            customVoices: [mockCustomVoiceFromServer],
          },
        }),
      });

      const prefs = await fetchPreferencesFromServer("http://localhost:4000", "child-firetv-2", "family-anderson-42");

      expect(prefs).toBeTruthy();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("userId=family-anderson-42"),
        expect.any(Object)
      );

      // Verify custom voice is now hydrated in localStorage for this child's device
      const localVoices = loadCustomVoices();
      expect(localVoices.some((v) => v.id === "custom_dad_9999")).toBe(true);
    });
  });
});
