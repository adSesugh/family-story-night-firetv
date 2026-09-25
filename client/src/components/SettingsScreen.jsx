import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Mic,
  Palette,
  Lock,
  Unlock,
  KeyRound,
  BarChart3,
  Trash2,
  Users,
  Award,
  Sparkles,
  BookOpen,
  Compass,
  Share2,
} from "lucide-react";
import {
  loadSettings,
  saveSettings,
  verifyPin,
  setPin,
} from "../utils/parentSettings";
import { summarize, clearEvents } from "../utils/analytics";
import { VOICES } from "../constants/voices";
import VoiceSelector from "./VoiceSelector";
import ConfirmModal from "./ConfirmModal";
import Toast from "./Toast";
import DpadController from "./DpadController";
import { getDeviceId, getUserId, setUserId } from "../utils/device";
import { syncPreferencesToServer } from "../utils/userPreferences";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:4000").trim().replace(/\/+$/, "");

const MAX_CUSTOM_THEME_LENGTH = 100;

const TABS = [
  { id: "story", label: "Story Preferences", shortLabel: "Story", icon: Mic },
  { id: "parent", label: "Parent Controls", shortLabel: "Parent", icon: Lock },
];

const ILLUSTRATION_STYLES = [
  { id: "watercolor", emoji: "🧸", label: "Claymation", desc: "Cute 3D chibi figures, soft felt textures & warm lighting" },
  { id: "storybook", emoji: "📚", label: "Storybook", desc: "Classic painted storybook picture illustration" },
  { id: "sketch", emoji: "✏️", label: "Sketch", desc: "Hand-drawn colored pencil drawings with warm outlines" },
];

export default function SettingsScreen({
  onBack,
  onSettingsChange,
  voice = "Joanna",
  setVoice,
  voices = VOICES,
  storyLength = 6,
  setStoryLength,
  illustrationStyle = "watercolor",
  setIllustrationStyle,
  themeMode = "preset",
  setThemeMode,
  customTheme = "",
  setCustomTheme,
  themes = [],
  themeIndex = 0,
  setThemeIndex,
  initialTab = "story",
  initialUnlocked = false,
}) {
  const [settingsData, setSettingsData] = useState(() => loadSettings());
  const [isUnlocked, setIsUnlocked] = useState(initialUnlocked);
  const [activeTab, setActiveTab] = useState(initialTab);
  const tabRefs = useRef({});
  const screenRef = useRef(null);

  // PIN setup / verify state
  const [pinInput, setPinInput] = useState("");
  const [confirmPinInput, setConfirmPinInput] = useState("");
  const [pinError, setPinError] = useState(null);
  const [isChangingPin, setIsChangingPin] = useState(false);

  // Analytics summary
  const [stats, setStats] = useState(() => summarize());
  const [confirmClearAnalytics, setConfirmClearAnalytics] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const hasPin = Boolean(settingsData.pinHash);
  const allowCustomThemes = settingsData.settings?.allowCustomThemes !== false;

  // Switching tabs also drops any half-typed PIN or unfinished "change PIN" flow.
  const selectTab = (id) => {
    if (id === activeTab) return;
    setActiveTab(id);
    setPinInput("");
    setConfirmPinInput("");
    setPinError(null);
    setIsChangingPin(false);
  };

  // Arrow keys / Home / End move between tabs.
  const handleTabKeyDown = (e) => {
    const current = TABS.findIndex((t) => t.id === activeTab);
    let next = null;
    if (e.key === "ArrowRight") next = (current + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (current - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    const nextId = TABS[next].id;
    selectTab(nextId);
    tabRefs.current[nextId]?.focus();
  };

  const handleDpadNavigate = useCallback(
    (direction) => {
      if (!screenRef.current) return;

      const focusableSelector =
        'button:not([disabled]):not([tabindex="-1"]), [role="tab"], input:not([disabled]), textarea:not([disabled]), select:not([disabled])';
      const rawElements = Array.from(screenRef.current.querySelectorAll(focusableSelector));

      const elements = rawElements.filter(
        (el) => !el.closest('[aria-hidden="true"]') && el.style.display !== "none"
      );

      if (direction === "left") {
        if (activeTab === "parent") {
          selectTab("story");
          tabRefs.current["story"]?.focus();
        } else {
          const activeEl = document.activeElement;
          const currentIndex = elements.indexOf(activeEl);
          const prevIndex =
            currentIndex === -1 ? elements.length - 1 : (currentIndex - 1 + elements.length) % elements.length;
          elements[prevIndex]?.focus();
          elements[prevIndex]?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
        }
        return;
      }

      if (direction === "right") {
        if (activeTab === "story") {
          selectTab("parent");
          tabRefs.current["parent"]?.focus();
        } else {
          const activeEl = document.activeElement;
          const currentIndex = elements.indexOf(activeEl);
          const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % elements.length;
          elements[nextIndex]?.focus();
          elements[nextIndex]?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
        }
        return;
      }

      if (elements.length === 0) return;

      const activeEl = document.activeElement;
      const currentIndex = elements.indexOf(activeEl);

      if (direction === "down") {
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % elements.length;
        elements[nextIndex]?.focus();
        elements[nextIndex]?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      } else if (direction === "up") {
        const prevIndex =
          currentIndex === -1 ? elements.length - 1 : (currentIndex - 1 + elements.length) % elements.length;
        elements[prevIndex]?.focus();
        elements[prevIndex]?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
      } else if (direction === "select") {
        if (activeEl && typeof activeEl.click === "function") {
          activeEl.click();
        }
      } else if (direction === "back") {
        if (onBack) onBack();
      }
    },
    [activeTab, onBack]
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput =
        e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA";

      if (isInput) {
        if (e.key === "Escape" || e.key === "GoBack" || e.keyCode === 4) {
          e.preventDefault();
          onBack?.();
        }
        return;
      }

      if (e.key === "ArrowDown" || e.keyCode === 40) {
        e.preventDefault();
        handleDpadNavigate("down");
      } else if (e.key === "ArrowUp" || e.keyCode === 38) {
        e.preventDefault();
        handleDpadNavigate("up");
      } else if (e.key === "ArrowLeft" || e.keyCode === 37) {
        e.preventDefault();
        handleDpadNavigate("left");
      } else if (e.key === "ArrowRight" || e.keyCode === 39) {
        e.preventDefault();
        handleDpadNavigate("right");
      } else if (e.key === "Enter" || e.keyCode === 13) {
        if (document.activeElement && typeof document.activeElement.click === "function") {
          e.preventDefault();
          document.activeElement.click();
        }
      } else if (
        e.key === "Escape" ||
        e.key === "Backspace" ||
        e.key === "GoBack" ||
        e.keyCode === 4 ||
        e.keyCode === 8 ||
        e.keyCode === 27
      ) {
        e.preventDefault();
        onBack?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDpadNavigate, onBack]);

  const handleCreatePin = (e) => {
    e?.preventDefault();
    setPinError(null);
    if (!/^\d{4}$/.test(pinInput)) {
      setPinError("PIN must be exactly 4 digits");
      return;
    }
    if (pinInput !== confirmPinInput) {
      setPinError("PINs do not match");
      return;
    }
    const updated = setPin(pinInput);
    setSettingsData(updated);
    setIsUnlocked(true);
    setIsChangingPin(false);
    setPinInput("");
    setConfirmPinInput("");
    if (onSettingsChange) onSettingsChange(updated);
  };

  const handleVerifyPin = (e) => {
    e?.preventDefault();
    setPinError(null);
    if (verifyPin(pinInput, settingsData.pinHash)) {
      setIsUnlocked(true);
      setPinInput("");
    } else {
      setPinError("Incorrect PIN");
    }
  };

  const handleToggleSetting = (key) => {
    const updated = {
      ...settingsData,
      settings: {
        ...settingsData.settings,
        [key]: !settingsData.settings[key],
      },
    };
    saveSettings(updated);
    setSettingsData(updated);
    if (onSettingsChange) onSettingsChange(updated);
  };

  const handleSelectSetting = (key, value) => {
    const updated = {
      ...settingsData,
      settings: {
        ...settingsData.settings,
        [key]: value,
      },
    };
    saveSettings(updated);
    setSettingsData(updated);
    if (onSettingsChange) onSettingsChange(updated);
  };

  const handleClearAnalytics = () => {
    setConfirmClearAnalytics(true);
  };

  const executeClearAnalytics = () => {
    clearEvents();
    setStats(summarize());
    setConfirmClearAnalytics(false);
    setToastMessage("Story analytics data cleared");
  };

  const [familyUserId, setFamilyUserId] = useState(() => getUserId());
  const [isEditingUserId, setIsEditingUserId] = useState(false);
  const [newUserIdInput, setNewUserIdInput] = useState("");

  const handleSaveUserId = (e) => {
    e?.preventDefault();
    if (newUserIdInput.trim()) {
      const updated = setUserId(newUserIdInput.trim());
      setFamilyUserId(updated);
      setIsEditingUserId(false);
      setToastMessage("Family Sync ID updated. Voices and preferences will now sync with this family.");
      syncPreferencesToServer(API_BASE, getDeviceId(), { userId: updated });
    }
  };

  const handleCopyUserId = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(familyUserId);
    }
    setToastMessage("Family ID copied to clipboard! Enter it on other devices to sync voices.");
  };

  return (
    <div
      ref={screenRef}
      className="relative z-10 flex h-full max-h-[95vh] w-full max-w-6xl flex-col overflow-y-auto px-4 py-4 sm:px-8 sm:py-6 md:px-10"
    >
      {/* Header */}
      <div className="mb-3 sm:mb-4 flex items-center justify-between">
        <div>
          <p className="font-sans text-xs sm:text-sm text-starlight">Family Story Night</p>
          <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl text-parchment">Settings</h1>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 sm:gap-2 rounded-sm bg-starlight/20 px-3.5 sm:px-5 py-1.5 sm:py-2 font-sans text-sm sm:text-base text-parchment transition-colors hover:bg-starlight/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-lamp cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Settings sections"
        onKeyDown={handleTabKeyDown}
        className="mb-5 sm:mb-6 grid grid-cols-2 border-b border-starlight/20 sm:flex sm:gap-2"
      >
        {TABS.map(({ id, label, shortLabel, icon }) => {
          const selected = activeTab === id;
          // The Parent tab shows an open lock once the PIN has been entered.
          const Icon = id === "parent" && hasPin && isUnlocked ? Unlock : icon;
          return (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[id] = el;
              }}
              type="button"
              role="tab"
              id={`settings-tab-${id}`}
              aria-selected={selected}
              aria-controls={selected ? `settings-panel-${id}` : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(id)}
              className={`-mb-px flex cursor-pointer items-center justify-center gap-2 border-b-2 px-3 py-2.5 font-sans text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lamp sm:px-6 sm:text-base ${selected
                  ? "border-lamp font-medium text-parchment"
                  : "border-transparent text-starlight hover:text-parchment"
                }`}
            >
              <Icon
                className={`h-4 w-4 ${selected ? "text-[#E8A33D]" : ""}`}
                aria-hidden="true"
              />
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab 1: Story Preferences (Voice & Theme) ── */}
      {activeTab === "story" && (
        <div
          role="tabpanel"
          id="settings-panel-story"
          aria-labelledby="settings-tab-story"
          className="grid grid-cols-1 items-start gap-6 md:grid-cols-2"
        >
          {/* Narrator Voice */}
          <div className="rounded-sm bg-panel/60 p-4 sm:p-6 shadow-lg">
            <div className="flex items-center gap-2.5 border-b border-starlight/20 pb-3">
              <Mic className="h-5 w-5 text-[#E8A33D]" />
              <h2 className="font-serif text-2xl text-parchment">
                <label htmlFor="settings-voice-select">Narrator Voice</label>
              </h2>
            </div>

            <div className="mt-4">
              <p className="text-xs text-starlight/70">
                Select the storyteller tone and cadence for tonight&rsquo;s reading.
              </p>
              <p className="mt-0.5 text-xs text-starlight/60">Click card to select or preview</p>
              <div className="mt-3">
                <VoiceSelector
                  id="settings-voice-select"
                  value={voice}
                  onChange={setVoice}
                  variant="cards"
                  voices={voices}
                />
              </div>
            </div>
          </div>

          {/* Column 2: Story Theme Style & Story Length */}
          <div className="flex flex-col gap-6">
            {/* Story Theme */}
            <div className="rounded-sm bg-panel/60 p-4 sm:p-6 shadow-lg">
              <div className="flex items-center gap-2.5 border-b border-starlight/20 pb-3">
                <Palette className="h-5 w-5 text-[#E8A33D]" />
                <h2 className="font-serif text-2xl text-parchment">Story Theme Style</h2>
              </div>

              <div className="mt-4">
                <p className="text-xs text-starlight/70">
                  Choose preset themes or craft your own personalized story theme.
                  {!allowCustomThemes && (
                    <span className="ml-1 text-lamp/80">
                      (Custom themes restricted by parent controls)
                    </span>
                  )}
                </p>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setThemeMode && setThemeMode("preset")}
                    className={`rounded-sm px-4 py-2 font-sans text-sm font-medium transition-colors ${themeMode === "preset"
                      ? "bg-lamp text-dusk"
                      : "bg-starlight/20 text-parchment hover:bg-starlight/30"
                      }`}
                    aria-pressed={themeMode === "preset"}
                  >
                    Preset
                  </button>
                  {allowCustomThemes && (
                    <button
                      type="button"
                      onClick={() => setThemeMode && setThemeMode("custom")}
                      className={`rounded-sm px-4 py-2 font-sans text-sm font-medium transition-colors ${themeMode === "custom"
                        ? "bg-lamp text-dusk"
                        : "bg-starlight/20 text-parchment hover:bg-starlight/30"
                        }`}
                      aria-pressed={themeMode === "custom"}
                    >
                      Custom
                    </button>
                  )}
                </div>

                {themeMode === "preset" && themes.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {themes.map((t, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setThemeIndex && setThemeIndex(i)}
                        className={`rounded-sm px-3 py-1.5 font-sans text-xs transition-colors ${i === themeIndex
                          ? "bg-lamp text-dusk font-medium"
                          : "bg-starlight/20 text-parchment hover:bg-starlight/30"
                          }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}

                {themeMode === "custom" && allowCustomThemes && (
                  <div className="mt-4">
                    <textarea
                      value={customTheme}
                      onChange={(e) =>
                        setCustomTheme &&
                        setCustomTheme(e.target.value.slice(0, MAX_CUSTOM_THEME_LENGTH))
                      }
                      placeholder="Describe your custom story theme..."
                      aria-label="Custom story theme"
                      maxLength={MAX_CUSTOM_THEME_LENGTH}
                      className="w-full rounded-sm border-b-2 border-starlight/40 bg-transparent px-1 py-2 font-serif text-sm text-parchment placeholder:text-starlight/50 focus:border-[#e8a33d] focus:outline-none"
                      rows="3"
                    />
                    <div className="mt-1 flex justify-end">
                      <span className="font-sans text-xs text-starlight/60">
                        {customTheme.length} / {MAX_CUSTOM_THEME_LENGTH}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Parental Controls Notice */}
            <div className="rounded-sm bg-panel/40 p-5 shadow-lg border border-starlight/10 flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <Lock className="h-5 w-5 text-lamp" />
                <h3 className="font-serif text-lg text-parchment">Parental Controls Protected</h3>
              </div>
              <p className="text-xs text-starlight/70 leading-relaxed">
                Story length, reading level (age guidance), and illustration art style are protected by your parent PIN to prevent bedtime disruptions.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("parent")}
                className="self-start rounded-full border border-lamp/40 bg-lamp/15 px-4 py-1.5 font-sans text-xs font-semibold text-lamp hover:bg-lamp/25 transition-colors cursor-pointer"
              >
                {hasPin && isUnlocked ? "Open Parent Controls" : hasPin ? "Enter PIN to Manage" : "Set PIN to Manage"} &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 2: Parent Controls (PIN, Content & Analytics) ── */}
      {activeTab === "parent" && (
        <div
          role="tabpanel"
          id="settings-panel-parent"
          aria-labelledby="settings-tab-parent"
        >
          {/* PIN Setup (no PIN set or user opted to change PIN) */}
          {!isUnlocked && (!hasPin || isChangingPin) && (
            <div className="mx-auto w-full max-w-md rounded-sm bg-panel/70 p-6 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[#E8A33D]" />
                <h2 className="font-serif text-2xl text-parchment">
                  {isChangingPin ? "Change Parent PIN" : "Create a 4-Digit Parent PIN"}
                </h2>
              </div>
              <p className="mt-2 font-sans text-sm text-starlight/80">
                Keep settings safe so only parents can modify content preferences and analytics.
              </p>

              <form onSubmit={handleCreatePin} className="mt-5 space-y-4">
                <div>
                  <label className="block font-sans text-sm text-starlight">
                    Enter 4-Digit PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    className="mt-1 w-full rounded-sm border-b-2 border-starlight/40 bg-transparent px-2 py-1.5 text-center font-mono text-2xl tracking-widest text-parchment focus:border-[#e8a33d] focus:outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block font-sans text-sm text-starlight">
                    Confirm PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    value={confirmPinInput}
                    onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    className="mt-1 w-full rounded-sm border-b-2 border-starlight/40 bg-transparent px-2 py-1.5 text-center font-mono text-2xl tracking-widest text-parchment focus:border-[#e8a33d] focus:outline-none"
                  />
                </div>

                {pinError && <p className="font-sans text-sm text-red-300">{pinError}</p>}

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-sm bg-lamp px-5 py-2 font-sans font-medium text-dusk transition-transform hover:scale-[1.02] focus:outline-none"
                  >
                    Save PIN
                  </button>
                  {isChangingPin && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangingPin(false);
                        setPinError(null);
                      }}
                      className="rounded-sm bg-starlight/20 px-4 py-2 font-sans text-parchment hover:bg-starlight/30"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* PIN Verification (PIN exists, locked) */}
          {hasPin && !isUnlocked && !isChangingPin && (
            <div className="mx-auto w-full max-w-md rounded-sm bg-panel/70 p-6 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-[#E8A33D]" />
                <h2 className="font-serif text-2xl text-parchment">Enter Parent PIN</h2>
              </div>
              <p className="mt-2 font-sans text-sm text-starlight/80">
                Please enter your 4-digit PIN to access parent controls.
              </p>

              <form onSubmit={handleVerifyPin} className="mt-5 space-y-4">
                <div>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    aria-label="Parent PIN"
                    className="w-full rounded-sm border-b-2 border-starlight/40 bg-transparent px-2 py-1.5 text-center font-mono text-3xl tracking-widest text-parchment focus:border-[#e8a33d] focus:outline-none"
                    autoFocus
                  />
                </div>

                {pinError && <p className="font-sans text-sm text-red-300">{pinError}</p>}

                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-sm bg-lamp px-6 py-2.5 font-sans font-medium text-dusk transition-transform hover:scale-[1.02] focus:outline-none"
                >
                  <Unlock className="h-4 w-4" />
                  <span>Unlock Controls</span>
                </button>
              </form>
            </div>
          )}

          {/* Unlocked Parent Controls & Analytics */}
          {isUnlocked && !isChangingPin && (
            <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
              {/* Content & Feature Preferences */}
              <div className="rounded-sm bg-panel/60 p-6 shadow-lg">
                <div className="flex items-center justify-between border-b border-starlight/20 pb-3">
                  <div className="flex items-center gap-2">
                    <Unlock className="h-5 w-5 text-[#E8A33D]" />
                    <h2 className="font-serif text-2xl text-parchment">
                      Content &amp; Feature Preferences
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setIsChangingPin(true);
                      setPinInput("");
                      setConfirmPinInput("");
                    }}
                    className="font-sans text-sm text-lamp hover:underline"
                  >
                    Change PIN
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  {/* Allow Custom Themes */}
                  <label className="flex cursor-pointer items-center justify-between">
                    <div>
                      <span className="font-sans text-sm text-parchment">Allow Custom Themes</span>
                      <p className="text-xs text-starlight/70">
                        When disabled, only preset story themes can be selected.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsData.settings?.allowCustomThemes !== false}
                      onChange={() => handleToggleSetting("allowCustomThemes")}
                      className="h-5 w-5 accent-[#e8a33d]"
                      aria-label="Allow Custom Themes"
                    />
                  </label>

                  {/* Allow Story History */}
                  <label className="flex cursor-pointer items-center justify-between">
                    <div>
                      <span className="font-sans text-sm text-parchment">Allow Story History</span>
                      <p className="text-xs text-starlight/70">
                        When disabled, story history is hidden from the setup screen.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsData.settings?.allowHistory !== false}
                      onChange={() => handleToggleSetting("allowHistory")}
                      className="h-5 w-5 accent-[#e8a33d]"
                      aria-label="Allow Story History"
                    />
                  </label>

                  {/* Age Guidance Chips */}
                  <div className="pt-2 border-t border-starlight/10">
                    <div>
                      <span className="font-sans text-sm text-parchment font-medium">Age Guidance</span>
                      <p className="text-xs text-starlight/70 mt-0.5">
                        Adjusts vocabulary, sentence length, and themes for young readers.
                      </p>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {[
                        { id: "all", label: "All Ages", emoji: "🌟" },
                        { id: "3+", label: "Preschool (3+)", emoji: "🐣" },
                        { id: "5+", label: "Early Readers (5+)", emoji: "📖" },
                        { id: "8+", label: "Independent (8+)", emoji: "🚀" },
                      ].map(({ id, label, emoji }) => {
                        const currentAge = settingsData.settings?.ageRestriction || "all";
                        const isSelected = currentAge === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              handleSelectSetting("ageRestriction", id);
                              if (id === "3+" && setStoryLength) setStoryLength(3);
                              else if (id === "5+" && setStoryLength) setStoryLength(6);
                              else if (id === "8+" && setStoryLength) setStoryLength(9);
                            }}
                            aria-pressed={isSelected}
                            aria-label={`Age Guidance: ${label}`}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-sans text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-dusk ${
                              isSelected
                                ? "border-lamp bg-lamp/20 text-lamp shadow-sm shadow-lamp/20 ring-1 ring-lamp/50"
                                : "border-starlight/20 bg-starlight/5 text-starlight/70 hover:border-starlight/40 hover:text-parchment"
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Story Length Chips */}
                  <div className="pt-2 border-t border-starlight/10">
                    <div>
                      <span className="font-sans text-sm text-parchment font-medium">Story Length</span>
                      <p className="text-xs text-starlight/70 mt-0.5">
                        Default bedtime story length and page count.
                      </p>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {[
                        { emoji: "🐣", label: "Toddler", ages: "2–4", length: 3, desc: "~2 min" },
                        { emoji: "📖", label: "Early Reader", ages: "5–7", length: 6, desc: "~5 min" },
                        { emoji: "🚀", label: "Chapter Book", ages: "8+", length: 9, desc: "~8 min" },
                      ].map(({ emoji, label, ages, length, desc }) => {
                        const currentLength = Number(settingsData.settings?.storyLength || storyLength || 6);
                        const isSelected = currentLength === length;
                        return (
                          <button
                            key={length}
                            type="button"
                            onClick={() => {
                              if (setStoryLength) setStoryLength(length);
                              handleSelectSetting("storyLength", length);
                            }}
                            aria-pressed={isSelected}
                            aria-label={`Story Length: ${label} (${ages}), ${length} pages, ${desc}`}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-sans text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-dusk ${
                              isSelected
                                ? "border-lamp bg-lamp/20 text-lamp shadow-sm shadow-lamp/20 ring-1 ring-lamp/50"
                                : "border-starlight/20 bg-starlight/5 text-starlight/70 hover:border-starlight/40 hover:text-parchment"
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{label}</span>
                            <span className="text-[10px] opacity-75 font-normal">({length}p · {ages})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Illustration Art Style Chips */}
                  <div className="pt-2 border-t border-starlight/10">
                    <div>
                      <span className="font-sans text-sm text-parchment font-medium">Illustration Style</span>
                      <p className="text-xs text-starlight/70 mt-0.5">
                        Default visual art style for generated bedtime illustrations.
                      </p>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {ILLUSTRATION_STYLES.map(({ id, emoji, label }) => {
                        const currentStyle = settingsData?.settings?.illustrationStyle || illustrationStyle || "watercolor";
                        const isSelected = currentStyle === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              if (setIllustrationStyle) setIllustrationStyle(id);
                              handleSelectSetting("illustrationStyle", id);
                            }}
                            aria-pressed={isSelected}
                            aria-label={`Illustration Style: ${label}`}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-sans text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-dusk ${
                              isSelected
                                ? "border-lamp bg-lamp/20 text-lamp shadow-sm shadow-lamp/20 ring-1 ring-lamp/50"
                                : "border-starlight/20 bg-starlight/5 text-starlight/70 hover:border-starlight/40 hover:text-parchment"
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Story Analytics */}
              <div className="rounded-sm bg-panel/60 p-6 shadow-lg">
                <div className="flex items-center justify-between border-b border-starlight/20 pb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-[#E8A33D]" />
                    <h2 className="font-serif text-2xl text-parchment">Story Analytics</h2>
                  </div>
                  <button
                    onClick={handleClearAnalytics}
                    className="flex items-center gap-1 rounded-sm bg-red-900/30 px-3 py-1 font-sans text-xs text-red-300 transition-colors hover:bg-red-900/50"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Clear Analytics Data</span>
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-sm bg-starlight/10 p-3">
                    <p className="font-sans text-xs text-starlight">Total Stories</p>
                    <p className="mt-1 font-serif text-2xl text-parchment">{stats.totalStories}</p>
                  </div>

                  <div className="rounded-sm bg-starlight/10 p-3">
                    <p className="font-sans text-xs text-starlight">Avg Completion</p>
                    <p className="mt-1 font-serif text-2xl text-parchment">
                      {stats.avgCompletionRate}%
                    </p>
                  </div>

                  <div className="rounded-sm bg-starlight/10 p-3">
                    <p className="font-sans text-xs text-starlight">Most Popular Theme</p>
                    <p className="mt-1 font-serif text-sm text-parchment line-clamp-1">
                      {stats.mostPopularTheme}
                    </p>
                  </div>

                  <div className="rounded-sm bg-starlight/10 p-3">
                    <p className="font-sans text-xs text-starlight">Favorite Voice</p>
                    <p className="mt-1 font-serif text-sm text-parchment">{stats.favoriteVoice}</p>
                  </div>

                  <div className="col-span-2 rounded-sm bg-starlight/10 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-starlight">
                      <Users className="h-3.5 w-3.5" />
                      <span>Frequently Featured</span>
                    </div>
                    <p className="mt-1 font-sans text-sm text-parchment">
                      {stats.topFamilyMembers.length > 0
                        ? stats.topFamilyMembers.join(", ")
                        : "None recorded"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Family Device Sync & Custom Voices */}
              <div className="rounded-sm bg-panel/60 p-6 shadow-lg">
                <div className="flex items-center gap-2 border-b border-starlight/20 pb-3">
                  <Share2 className="h-5 w-5 text-[#E8A33D]" />
                  <h2 className="font-serif text-2xl text-parchment">
                    Family Sync &amp; Custom Voices
                  </h2>
                </div>
                <p className="mt-3 text-xs text-starlight/80">
                  Recorded family voices (Mom, Dad, Grandparents) and bedtime stories sync across all your children&apos;s devices using this Family ID.
                </p>

                <div className="mt-4 rounded-sm bg-starlight/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-starlight/60 font-mono">Family Account ID</span>
                    <p className="font-mono text-base font-bold text-lamp select-all">{familyUserId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyUserId}
                      className="rounded-sm bg-starlight/20 px-3 py-1.5 font-sans text-xs text-parchment hover:bg-starlight/30 transition-colors cursor-pointer"
                    >
                      Copy ID
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingUserId(!isEditingUserId);
                        setNewUserIdInput(familyUserId);
                      }}
                      className="rounded-sm bg-lamp/20 px-3 py-1.5 font-sans text-xs text-lamp hover:bg-lamp/30 transition-colors cursor-pointer"
                    >
                      {isEditingUserId ? "Cancel" : "Change ID"}
                    </button>
                  </div>
                </div>

                {isEditingUserId && (
                  <form onSubmit={handleSaveUserId} className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={newUserIdInput}
                      onChange={(e) => setNewUserIdInput(e.target.value)}
                      placeholder="Enter family ID (e.g. family-smith)"
                      className="flex-1 rounded-sm border border-starlight/30 bg-dusk/60 px-3 py-1.5 font-mono text-xs text-parchment focus:border-lamp focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-sm bg-lamp px-4 py-1.5 font-sans text-xs font-medium text-dusk hover:scale-[1.02] cursor-pointer"
                    >
                      Save ID
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Fire TV D-Pad Remote Controller & Navigator ── */}
      <div className="mt-8 pt-5 border-t border-starlight/20 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-center md:text-left">
          <p className="font-serif text-lg text-parchment flex items-center justify-center md:justify-start gap-2">
            <Compass className="h-4 w-4 text-[#E8A33D]" />
            <span>Fire TV 10-Foot D-Pad Navigation</span>
          </p>
          <p className="font-sans text-xs text-starlight/70 max-w-md mt-1">
            Navigate all settings using your Fire TV remote D-pad, keyboard arrow keys, or the interactive on-screen controller.
          </p>
        </div>
        <DpadController onNavigate={handleDpadNavigate} />
      </div>

      {/* Confirmation Modal */}
      {confirmClearAnalytics && (
        <ConfirmModal
          isOpen={confirmClearAnalytics}
          title="Clear Analytics Data?"
          message="Are you sure you want to clear all recorded bedtime story analytics? This will reset all story counts, active reading times, and favorite themes."
          confirmText="Clear Analytics"
          cancelText="Keep Data"
          confirmVariant="danger"
          onConfirm={executeClearAnalytics}
          onCancel={() => setConfirmClearAnalytics(false)}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type="success"
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}