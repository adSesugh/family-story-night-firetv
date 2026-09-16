import React, { useState, useEffect } from "react";
import { Play, Square, Check, Volume2, Moon, Compass, Sparkles, Sun } from "lucide-react";
import { VOICES } from "../constants/voices";

const VOICE_ICONS = {
  Joanna: Moon,
  Matthew: Compass,
  Emma: Sparkles,
  Ivy: Sun,
};

export default function VoiceSelector({
  value = "Joanna",
  onChange,
  variant = "cards", // "cards" | "compact"
  id = "voice-selector",
}) {
  const [playingVoiceId, setPlayingVoiceId] = useState(null);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handlePreview = (e, voiceObj) => {
    e.stopPropagation();

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    if (playingVoiceId === voiceObj.id) {
      window.speechSynthesis.cancel();
      setPlayingVoiceId(null);
      return;
    }

    window.speechSynthesis.cancel();
    setPlayingVoiceId(voiceObj.id);

    const utterance = new SpeechSynthesisUtterance(voiceObj.previewSnippet);
    utterance.rate = 0.92;
    utterance.pitch = voiceObj.id === "Matthew" ? 0.8 : voiceObj.id === "Ivy" ? 1.25 : 1.0;

    const systemVoices = window.speechSynthesis.getVoices?.() || [];
    const matched = systemVoices.find(
      (v) =>
        v.name.toLowerCase().includes(voiceObj.id.toLowerCase()) ||
        (voiceObj.id === "Matthew" && v.name.toLowerCase().includes("male"))
    );
    if (matched) utterance.voice = matched;

    utterance.onend = () => setPlayingVoiceId(null);
    utterance.onerror = () => setPlayingVoiceId(null);

    window.speechSynthesis.speak(utterance);
  };

  const handleSelect = (voiceId) => {
    if (onChange) onChange(voiceId);
  };

  return (
    <div className="w-full">
      {/* Accessible native select for test automation & screen readers */}
      <select
        id={id}
        aria-label="Narrator Voice"
        value={value}
        onChange={(e) => handleSelect(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      >
        {VOICES.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>

      {/* ── Rich Card Grid Variant ── */}
      {variant === "cards" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {VOICES.map((v) => {
            const isSelected = value === v.id;
            const isPlaying = playingVoiceId === v.id;
            const IconComponent = VOICE_ICONS[v.id] || Volume2;

            return (
              <div
                key={v.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => handleSelect(v.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect(v.id);
                  }
                }}
                className={`group relative flex flex-col justify-between rounded-lg border p-4 text-left transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8A33D] ${
                  isSelected
                    ? "border-[#E8A33D] bg-gradient-to-b from-[#E8A33D]/15 to-starlight/5 shadow-md shadow-[#E8A33D]/10"
                    : "border-starlight/20 bg-panel/70 hover:border-starlight/40 hover:bg-panel/90"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform group-hover:scale-105 ${
                          isSelected
                            ? "bg-[#E8A33D]/25 text-[#E8A33D] ring-2 ring-[#E8A33D]/50"
                            : "bg-starlight/15 text-starlight"
                        }`}
                      >
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-serif text-base font-medium text-parchment">
                            {v.displayName || v.id}
                          </span>
                          {isSelected && (
                            <span className="flex items-center gap-1 rounded-full bg-[#E8A33D]/20 px-2 py-0.5 text-[10px] font-medium text-[#E8A33D] ring-1 ring-[#E8A33D]/40">
                              <Check className="h-2.5 w-2.5" />
                              Active
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-starlight/70">
                          {v.tagline}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-starlight/80">
                    {v.description}
                  </p>
                </div>

                {/* Footer with Audio Preview Button */}
                <div className="mt-3.5 flex items-center justify-between border-t border-starlight/10 pt-2.5">
                  <span className="text-[11px] text-starlight/50">
                    {v.pitch}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => handlePreview(e, v)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none ${
                      isPlaying
                        ? "bg-[#E8A33D] text-dusk"
                        : "bg-starlight/15 text-parchment hover:bg-starlight/25"
                    }`}
                    aria-label={`Preview ${v.displayName} voice`}
                  >
                    {isPlaying ? (
                      <>
                        <Square className="h-3 w-3 fill-current" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 fill-current" />
                        <span>Preview</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Compact Variant ── */
        <div className="flex flex-wrap gap-2">
          {VOICES.map((v) => {
            const isSelected = value === v.id;
            const IconComponent = VOICE_ICONS[v.id] || Volume2;

            return (
              <button
                key={v.id}
                type="button"
                onClick={() => handleSelect(v.id)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all ${
                  isSelected
                    ? "border-[#E8A33D] bg-[#E8A33D]/20 text-parchment shadow-sm"
                    : "border-starlight/20 bg-dusk/70 text-starlight hover:border-starlight/40 hover:text-parchment"
                }`}
                aria-pressed={isSelected}
              >
                <IconComponent className={`h-3.5 w-3.5 ${isSelected ? "text-[#E8A33D]" : "text-starlight/70"}`} />
                <div>
                  <div className="font-serif text-xs font-medium text-parchment">
                    {v.displayName || v.id}
                  </div>
                  <div className="text-[10px] text-starlight/70">{v.tagline}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
