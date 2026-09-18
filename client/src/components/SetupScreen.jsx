import React from "react";
import { VOICES } from "../constants/voices";
import VoiceSelector from "./VoiceSelector";
import { ArrowLeft, CogIcon, History, BookOpen, Sparkles, Mic, MicOff } from "lucide-react";
import { useSpeechRecognition } from "../utils/useSpeechRecognition";

export default function SetupScreen({
  names,
  setNames,
  themeIndex,
  setThemeIndex,
  category = "adventures",
  setCategory,
  categories = [],
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

  const namesSpeech = useSpeechRecognition({
    onResult: (text) => setNames(text),
  });

  const themeSpeech = useSpeechRecognition({
    onResult: (text) => setCustomTheme && setCustomTheme(text.slice(0, maxCustomThemeLength)),
  });

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
      <h1 className="mt-2 font-serif text-5xl leading-tight text-parchment">
        {category === "bible" ? "Who\u2019s listening tonight?" : "Who\u2019s in tonight\u2019s story?"}
      </h1>

      <div className="relative mt-10">
        <input
          className="w-full rounded-sm border-b-2 border-starlight/40 bg-transparent pr-12 px-1 py-3 font-serif text-3xl text-parchment placeholder:text-starlight/50 focus:border-[#e8a33d] focus:outline-none"
          value={names}
          onChange={(e) => setNames(e.target.value)}
          placeholder={
            category === "bible"
              ? "(Optional) Maya, Dad... or leave blank"
              : "Maya, Dad, Biscuit the dog"
          }
          autoFocus
        />
        {namesSpeech.isSupported && (
          <button
            type="button"
            onClick={namesSpeech.toggleListening}
            aria-label={namesSpeech.isListening ? "Stop listening" : "Speak names into remote"}
            title={namesSpeech.isListening ? "Listening... click to stop" : "Speak names with voice"}
            className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-9 w-9 rounded-full transition-all cursor-pointer ${
              namesSpeech.isListening
                ? "bg-lamp text-night animate-pulse shadow-lg shadow-lamp/50 scale-110"
                : "bg-starlight/15 text-starlight hover:bg-starlight/25 hover:text-parchment"
            }`}
          >
            {namesSpeech.isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        )}
      </div>
      {namesSpeech.isListening && (
        <div className="mt-2 flex items-center gap-2 text-xs font-sans text-lamp animate-fade-in">
          <span className="h-2 w-2 rounded-full bg-lamp animate-ping" />
          <span>Listening... speak family names into your remote</span>
        </div>
      )}
      {category === "bible" && (
        <p className="mt-2 font-sans text-xs text-starlight/60">
          Names are optional for Bible stories &mdash; leave blank for the classic story, or enter names to weave family in.
        </p>
      )}

      {/* Theme Section */}
      <div className="mt-8">
        {activeThemeMode === "preset" ? (
          <div>
            {/* Category Selector Tabs */}
            {categories && categories.length > 1 && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs uppercase tracking-wider text-starlight/60 font-sans font-medium mr-1">
                  Collection:
                </span>
                <div className="flex gap-2" role="tablist" aria-label="Story Categories">
                  {categories.map((cat) => {
                    const isSelected = (category || "adventures") === cat.id;
                    const IconComponent = cat.id === "bible" ? BookOpen : Sparkles;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        data-testid={`category-tab-${cat.id}`}
                        onClick={() => {
                          if (setCategory) {
                            setCategory(cat.id);
                            setThemeIndex(0);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-sans text-xs font-semibold transition-all ${isSelected
                            ? "bg-lamp/25 text-lamp border border-lamp/60 shadow-md shadow-lamp/10"
                            : "bg-starlight/10 text-starlight/75 border border-transparent hover:bg-starlight/20 hover:text-parchment"
                          }`}
                      >
                        <IconComponent size={14} />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3 font-sans text-base">
              <span className="text-starlight text-sm">Tonight&rsquo;s theme</span>
              <span className="text-parchment font-serif text-lg md:text-xl font-medium tracking-wide">
                {themes[themeIndex]}
              </span>
              <div className="flex gap-1.5">
                {themes.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setThemeIndex(i)}
                    className={`h-2.5 w-2.5 rounded-full transition-colors ${i === themeIndex ? "bg-lamp scale-110" : "bg-starlight/30 hover:bg-starlight/50"
                      }`}
                    aria-label={`Theme ${i + 1}`}
                  />
                ))}
              </div>
              <span className="text-starlight/60 text-xs">↑ / ↓ to change</span>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <div className="relative">
              <textarea
                value={customTheme}
                onChange={(e) =>
                  setCustomTheme && setCustomTheme(e.target.value.slice(0, maxCustomThemeLength))
                }
                placeholder="Describe your custom story theme..."
                maxLength={maxCustomThemeLength}
                className="w-full rounded-sm border-b-2 border-starlight/40 bg-transparent pr-12 px-1 py-3 font-serif text-base text-parchment placeholder:text-starlight/50 focus:border-[#e8a33d] focus:outline-none"
                rows="2"
              />
              {themeSpeech.isSupported && (
                <button
                  type="button"
                  onClick={themeSpeech.toggleListening}
                  aria-label={themeSpeech.isListening ? "Stop listening" : "Speak custom theme into remote"}
                  title={themeSpeech.isListening ? "Listening... click to stop" : "Speak custom theme with voice"}
                  className={`absolute right-2 top-3 flex items-center justify-center h-8 w-8 rounded-full transition-all cursor-pointer ${
                    themeSpeech.isListening
                      ? "bg-lamp text-night animate-pulse shadow-lg shadow-lamp/50 scale-110"
                      : "bg-starlight/15 text-starlight hover:bg-starlight/25 hover:text-parchment"
                  }`}
                >
                  {themeSpeech.isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              )}
            </div>
            {themeSpeech.isListening && (
              <div className="mt-1 flex items-center gap-2 text-xs font-sans text-lamp animate-fade-in">
                <span className="h-2 w-2 rounded-full bg-lamp animate-ping" />
                <span>Listening... describe your story theme into your remote</span>
              </div>
            )}
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
              className={`flex-1 rounded-sm px-3 py-2 font-sans text-xs font-medium transition-colors ${storyLength === length
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

      {error && <p className="mt-6 font-sans text-base text-red-300">{error}</p>}
      {customThemeError && (
        <p className="mt-2 font-sans text-base text-red-300">{customThemeError}</p>
      )}

      <div className="flex gap-2 mt-8">
        {allowHistory && hasHistory && (
          <button
            type="button"
            onClick={onViewHistory}
            className="flex gap-2 items-center rounded-sm bg-starlight/20 px-8 py-2 font-sans text-lg font-medium text-parchment transition-transform hover:scale-[1.02] focus:outline-none"
          >
            <History size={16} /> View History
          </button>
        )}
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-sm bg-lamp px-8 py-2 font-sans text-lg font-medium text-dusk transition-transform hover:scale-[1.02] focus:outline-none"
        >
          Begin the story
        </button>
      </div>
      <p className="mt-3 font-sans text-sm text-starlight/60">or press Enter</p>
    </div>
  );
}
