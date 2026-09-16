import React, { useState } from "react";
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

const MAX_CUSTOM_THEME_LENGTH = 100;

export default function SettingsScreen({
  onBack,
  onSettingsChange,
  voice = "Joanna",
  setVoice,
  themeMode = "preset",
  setThemeMode,
  customTheme = "",
  setCustomTheme,
  themes = [],
  themeIndex = 0,
  setThemeIndex,
}) {
  const [settingsData, setSettingsData] = useState(() => loadSettings());
  const [isUnlocked, setIsUnlocked] = useState(false);

  // PIN setup / verify state
  const [pinInput, setPinInput] = useState("");
  const [confirmPinInput, setConfirmPinInput] = useState("");
  const [pinError, setPinError] = useState(null);
  const [isChangingPin, setIsChangingPin] = useState(false);

  // Analytics summary
  const [stats, setStats] = useState(() => summarize());

  const hasPin = Boolean(settingsData.pinHash);
  const allowCustomThemes = settingsData.settings?.allowCustomThemes !== false;

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
    if (window.confirm("Clear all recorded story analytics?")) {
      clearEvents();
      setStats(summarize());
    }
  };

  return (
    <div className="relative z-10 flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-y-auto px-6 py-6 sm:px-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between border-b border-starlight/20 pb-4">
        <div>
          <p className="font-sans text-sm text-starlight">Family Story Night</p>
          <h1 className="font-serif text-3xl sm:text-4xl text-parchment">Settings</h1>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-sm bg-starlight/20 px-5 py-2 font-sans text-base text-parchment transition-colors hover:bg-starlight/30 focus:outline-none"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* ── Column 1: Story Preferences (Voice & Theme) ── */}
        <div className="space-y-6">
          <div className="rounded-sm bg-panel/60 p-6 shadow-lg">
            <div className="flex items-center gap-2.5 border-b border-starlight/20 pb-3">
              <Mic className="h-5 w-5 text-[#E8A33D]" />
              <h2 className="font-serif text-2xl text-parchment">
                Story Preferences
              </h2>
            </div>

            <div className="mt-6 space-y-6">
              {/* Voice Selector */}
              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="settings-voice-select"
                    className="block font-sans text-base font-medium text-parchment"
                  >
                    Narrator Voice
                  </label>
                  <span className="text-xs text-starlight/60">Click card to select or preview</span>
                </div>
                <p className="mt-0.5 text-xs text-starlight/70">
                  Select the storyteller tone and cadence for tonight&rsquo;s reading.
                </p>
                <div className="mt-3">
                  <VoiceSelector
                    id="settings-voice-select"
                    value={voice}
                    onChange={setVoice}
                    variant="cards"
                  />
                </div>
              </div>

              {/* Theme Selector / Custom Theme */}
              <div>
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-[#E8A33D]" />
                  <span className="block font-sans text-base font-medium text-parchment">
                    Story Theme Style
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-starlight/70">
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
          </div>
        </div>

        {/* ── Column 2: Parent Controls & Analytics ── */}
        <div className="space-y-6">
          {/* PIN Setup (no PIN set or user opted to change PIN) */}
          {(!hasPin || isChangingPin) && (
            <div className="rounded-sm bg-panel/70 p-6 shadow-lg backdrop-blur-sm">
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
            <div className="rounded-sm bg-panel/70 p-6 shadow-lg backdrop-blur-sm">
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
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
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
          {hasPin && isUnlocked && !isChangingPin && (
            <>
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

                  {/* Age Restriction */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <span className="font-sans text-sm text-parchment">Age Guidance</span>
                      <p className="text-xs text-starlight/70">
                        Adjusts vocabulary and themes for young readers.
                      </p>
                    </div>
                    <select
                      value={settingsData.settings?.ageRestriction || "all"}
                      onChange={(e) => handleSelectSetting("ageRestriction", e.target.value)}
                      className="rounded-sm border border-starlight/30 bg-dusk px-3 py-1 font-sans text-xs text-parchment focus:border-[#e8a33d] focus:outline-none"
                      aria-label="Age Guidance"
                    >
                      <option value="all">All Ages (Gentle)</option>
                      <option value="3+">Preschool (3+)</option>
                      <option value="5+">Early Readers (5+)</option>
                      <option value="8+">Independent (8+)</option>
                    </select>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
