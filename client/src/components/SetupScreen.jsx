import React from "react";
import { VOICES } from "../constants/voices";
import VoiceSelector from "./VoiceSelector";
import { ArrowLeft, CogIcon, History } from "lucide-react";

export default function SetupScreen({
  names,
  setNames,
  themeIndex,
  setThemeIndex,
  error,
  onSubmit,
  themes,
  hasHistory,
  onViewHistory,
  themeMode = "preset",
  setThemeMode,
  customTheme = "",
  setCustomTheme,
  customThemeError,
  voice = "Joanna",
  setVoice,
  storyLength = 6,
  setStoryLength,
  parentSettings,
  onOpenSettings,
}) {
  const maxCustomThemeLength = 100;
  const allowCustomThemes = parentSettings?.settings?.allowCustomThemes !== false;
  const allowHistory = parentSettings?.settings?.allowHistory !== false;
  const activeThemeMode = allowCustomThemes ? themeMode : "preset";

  return (
    <div className="relative z-10 w-full max-w-2xl px-12">
      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="absolute -top-10 right-12 flex items-center gap-1.5 rounded-sm bg-starlight/15 px-3 py-1.5 font-sans text-sm text-starlight transition-colors hover:bg-starlight/25 hover:text-parchment"
          aria-label="Parent Settings"
        >
          <CogIcon size={16} /> Settings
        </button>
      )}

      <p className="font-sans text-lg text-starlight">Family Story Night</p>
      <h1 className="mt-2 font-serif text-6xl leading-tight text-parchment">
        Who&rsquo;s in tonight&rsquo;s story?
      </h1>

      <input
        className="mt-10 w-full rounded-sm border-b-2 border-starlight/40 bg-transparent px-1 py-3 font-serif text-3xl text-parchment placeholder:text-starlight/50 focus:border-[#e8a33d] focus:outline-none"
        value={names}
        onChange={(e) => setNames(e.target.value)}
        placeholder="Maya, Dad, Biscuit the dog"
        autoFocus
      />

      {/* Theme Section */}
      <div className="mt-8">
        {activeThemeMode === "preset" ? (
          <div className="mt-4 flex items-center gap-4 font-sans text-base">
            <span className="text-starlight">Tonight&rsquo;s theme</span>
            <span className="text-parchment">{themes[themeIndex]}</span>
            <div className="flex gap-1">
              {themes.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setThemeIndex(i)}
                  className={`h-2 w-2 rounded-full transition-colors ${i === themeIndex ? "bg-lamp" : "bg-starlight/30"
                    }`}
                  aria-label={`Theme ${i + 1}`}
                />
              ))}
            </div>
            <span className="text-starlight/60">↑ / ↓ to change</span>
          </div>
        ) : (
          <div className="mt-4">
            <textarea
              value={customTheme}
              onChange={(e) =>
                setCustomTheme && setCustomTheme(e.target.value.slice(0, maxCustomThemeLength))
              }
              placeholder="Describe your custom story theme..."
              maxLength={maxCustomThemeLength}
              className="w-full rounded-sm border-b-2 border-starlight/40 bg-transparent px-1 py-3 font-serif text-base text-parchment placeholder:text-starlight/50 focus:border-[#e8a33d] focus:outline-none"
              rows="2"
            />
            <div className="mt-2 flex justify-between">
              <div />
              <span className="font-sans text-sm text-starlight/60">
                {customTheme.length} / {maxCustomThemeLength}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Story Length */}
      <div className="mt-6">
        <span className="block font-sans text-sm text-starlight">Story Length</span>
        <div className="mt-2 flex gap-2">
          {[
            { length: 4, label: "Short (4p)" },
            { length: 6, label: "Standard (6p)" },
            { length: 8, label: "Long (8p)" },
          ].map(({ length, label }) => (
            <button
              key={length}
              type="button"
              onClick={() => setStoryLength && setStoryLength(length)}
              className={`flex-1 rounded-sm px-3 py-2 font-sans text-xs font-medium transition-colors ${
                storyLength === length
                  ? "bg-lamp text-dusk font-semibold shadow-sm"
                  : "bg-starlight/20 text-parchment hover:bg-starlight/30"
              }`}
              aria-pressed={storyLength === length}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {allowHistory && hasHistory && (
        <button
          type="button"
          onClick={onViewHistory}
          className="mr-2 mt-8 rounded-sm bg-starlight/20 px-8 py-3 font-sans text-lg font-medium text-parchment transition-transform hover:scale-[1.02] focus:outline-none"
        >
          <History /> View History
        </button>
      )}

      {error && <p className="mt-6 font-sans text-base text-red-300">{error}</p>}
      {customThemeError && (
        <p className="mt-2 font-sans text-base text-red-300">{customThemeError}</p>
      )}

      <button
        type="button"
        onClick={onSubmit}
        className="mt-8 rounded-sm bg-lamp px-8 py-3 font-sans text-lg font-medium text-dusk transition-transform hover:scale-[1.02] focus:outline-none"
      >
        Begin the story
      </button>
      <p className="mt-3 font-sans text-sm text-starlight/60">or press Enter</p>
    </div>
  );
}
