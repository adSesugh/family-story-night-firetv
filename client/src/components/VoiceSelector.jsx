import React, { useState, useEffect, useRef } from "react";
import { Play, Square, Check, Volume2, Moon, Compass, Sparkles, Sun, Plus, Trash2, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { VOICES } from "../constants/voices";
import {
  loadCustomVoices,
  deleteCustomVoice,
  syncCustomVoiceToServer,
  deleteCustomVoiceFromServer,
} from "../utils/customVoices";
import { getDeviceId, getUserId } from "../utils/device";
import FamilyVoiceStudioModal from "./FamilyVoiceStudioModal";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:4000").trim().replace(/\/+$/, "");

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
  onNavigateUp,
  onNavigateDown,
  voices = VOICES,
}) {
  const [customVoices, setCustomVoices] = useState([]);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const customAudioPlayerRef = useRef(null);
  const voiceRowRef = useRef(null);

  const refreshVoices = () => {
    setCustomVoices(loadCustomVoices());
  };

  useEffect(() => {
    refreshVoices();
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (customAudioPlayerRef.current) {
        customAudioPlayerRef.current.pause();
        customAudioPlayerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (voiceRowRef.current && variant === "compact") {
      const selectedBtn = voiceRowRef.current.querySelector('[aria-pressed="true"]');
      if (selectedBtn && typeof selectedBtn.scrollIntoView === "function") {
        selectedBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [value, variant]);

  const allVoices = [...customVoices, ...voices];

  const fallbackPreview = (voiceObj) => {
    const targetTone = voiceObj.baseVoice || voiceObj.id || "Joanna";

    // Try SpeechSynthesis if supported
    if (typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined") {
      try {
        const snippet = voiceObj.previewSnippet || "The stars are shining softly tonight. Close your eyes and dream of magic.";
        const utterance = new SpeechSynthesisUtterance(snippet);
        utterance.rate = 0.92;
        utterance.pitch = targetTone === "Matthew" ? 0.8 : targetTone === "Ivy" ? 1.25 : 1.0;

        const systemVoices = window.speechSynthesis.getVoices?.() || [];
        const matched = systemVoices.find(
          (v) =>
            v.name.toLowerCase().includes(targetTone.toLowerCase()) ||
            (targetTone === "Matthew" && v.name.toLowerCase().includes("male"))
        );
        if (matched) utterance.voice = matched;

        utterance.onend = () => setPlayingVoiceId(null);
        utterance.onerror = () => setPlayingVoiceId(null);

        window.speechSynthesis.speak(utterance);
        return;
      } catch (e) {
        console.warn("SpeechSynthesis error:", e);
      }
    }

    // Server Polly fallback for devices without Web Speech API (e.g. Fire TV WebViews)
    if (typeof fetch === "function") {
      fetch(`${API_BASE}/narrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: voiceObj.previewSnippet || "The stars are shining softly tonight. Close your eyes and dream of magic.",
          voiceId: targetTone,
          baseVoice: targetTone,
        }),
      })
        .then((r) => (r.ok ? (r.headers.get("content-type")?.includes("application/json") ? r.json() : r.blob()) : null))
        .then((result) => {
          if (!result) {
            setPlayingVoiceId(null);
            return;
          }
          let audioUrl = "";
          if (typeof result === "object" && result.audio) {
            audioUrl = result.audio;
          } else if (result instanceof Blob && typeof URL.createObjectURL === "function") {
            audioUrl = URL.createObjectURL(result);
          }
          if (audioUrl) {
            const audio = new Audio(audioUrl);
            customAudioPlayerRef.current = audio;
            audio.onended = () => setPlayingVoiceId(null);
            audio.onerror = () => setPlayingVoiceId(null);
            audio.play().catch(() => setPlayingVoiceId(null));
          } else {
            setPlayingVoiceId(null);
          }
        })
        .catch(() => setPlayingVoiceId(null));
    } else {
      setPlayingVoiceId(null);
    }
  };

  const handlePreview = (e, voiceObj) => {
    e.stopPropagation();

    // Stop speech synthesis if running
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    // Stop custom audio if running
    if (customAudioPlayerRef.current) {
      try { customAudioPlayerRef.current.pause(); } catch (e) {}
      customAudioPlayerRef.current = null;
    }

    if (playingVoiceId === voiceObj.id) {
      setPlayingVoiceId(null);
      return;
    }

    setPlayingVoiceId(voiceObj.id);

    // If custom voice has a recorded audio sample, play that!
    if (voiceObj.isCustom && voiceObj.audioDataUrl) {
      try {
        const audio = new Audio(voiceObj.audioDataUrl);
        customAudioPlayerRef.current = audio;
        audio.onended = () => setPlayingVoiceId(null);
        audio.onerror = () => {
          fallbackPreview(voiceObj);
        };
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            fallbackPreview(voiceObj);
          });
        }
        return;
      } catch (err) {
        console.warn("Custom audio playback failed, falling back:", err);
      }
    }

    fallbackPreview(voiceObj);
  };

  const handleSelect = (voiceId) => {
    if (onChange) onChange(voiceId);
  };

  const handleDeleteCustomVoice = (e, voiceId) => {
    e.stopPropagation();
    deleteCustomVoice(voiceId);
    deleteCustomVoiceFromServer(API_BASE, voiceId, getDeviceId(), getUserId());
    refreshVoices();
    if (value === voiceId) {
      handleSelect("Joanna");
    }
  };

  const handleVoiceCreated = (newVoice) => {
    refreshVoices();
    if (newVoice?.id) {
      syncCustomVoiceToServer(API_BASE, getDeviceId(), getUserId(), newVoice);
      handleSelect(newVoice.id);
    }
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
        {allVoices.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>

      {/* ── Rich Card Grid Variant ── */}
      {variant === "cards" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Custom Voices first (with special badge) then built-in */}
          {allVoices.map((v) => {
            const isSelected = value === v.id;
            const isPlaying = playingVoiceId === v.id;
            const IconComponent = v.isCustom ? Heart : VOICE_ICONS[v.id] || Volume2;

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
                className={`group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-lamp ${
                  isSelected
                    ? "border-lamp bg-gradient-to-b from-lamp/20 to-starlight/5 shadow-md shadow-lamp/15 ring-2 ring-lamp/60"
                    : "border-starlight/20 bg-panel/70 hover:border-starlight/40 hover:bg-panel/90"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform group-hover:scale-105 ${
                          isSelected
                            ? "bg-lamp/25 text-lamp ring-2 ring-lamp/50"
                            : v.isCustom
                            ? "bg-rose-500/20 text-rose-300"
                            : "bg-starlight/15 text-starlight"
                        }`}
                      >
                        {v.avatar && v.isCustom ? (
                          <span className="text-base">{v.avatar}</span>
                        ) : (
                          <IconComponent className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-serif text-base font-medium text-parchment">
                            {v.displayName || v.name}
                          </span>
                          {v.isCustom && (
                            <span className="flex items-center gap-0.5 rounded-full bg-rose-500/20 px-2 py-0.5 text-[9px] font-semibold text-rose-300 ring-1 ring-rose-500/40">
                              <Sparkles className="h-2.5 w-2.5" />
                              Family Voice Clone
                            </span>
                          )}
                          {isSelected && (
                            <span className="flex items-center justify-center rounded-full bg-lamp/20 p-1 text-lamp ring-1 ring-lamp/40" title="Selected">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-starlight/70">{v.tagline}</span>
                      </div>
                    </div>

                    {v.isCustom && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCustomVoice(e, v.id)}
                        className="opacity-60 hover:opacity-100 p-1 text-starlight/60 hover:text-red-400 transition-colors"
                        title="Delete custom voice"
                        aria-label={`Delete ${v.displayName} voice`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-starlight/80">
                    {v.description}
                  </p>
                </div>

                {/* Footer with Audio Preview Button */}
                <div className="mt-3.5 flex items-center justify-between border-t border-starlight/10 pt-2.5">
                  <span className="text-[11px] text-starlight/50">{v.pitch}</span>

                  <button
                    type="button"
                    onClick={(e) => handlePreview(e, v)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none cursor-pointer ${
                      isPlaying
                        ? "bg-lamp text-night font-bold"
                        : "bg-starlight/15 text-parchment hover:bg-starlight/25"
                    }`}
                    aria-label={`Preview ${v.displayName || v.name} voice`}
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

          {/* "+ Record Loved One's Voice" Action Card */}
          <div
            role="button"
            tabIndex={0}
            data-testid="record-family-voice-btn"
            onClick={() => setIsStudioOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsStudioOpen(true);
              }
            }}
            className="group flex flex-col items-center justify-center rounded-xl border border-dashed border-lamp/40 bg-panel/40 p-4 text-center hover:border-lamp hover:bg-panel/70 transition-all cursor-pointer min-h-[140px]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lamp/15 text-lamp group-hover:scale-110 transition-transform mb-2">
              <Plus className="h-5 w-5" />
            </div>
            <span className="font-serif text-sm font-semibold text-parchment group-hover:text-lamp transition-colors">
              + Record Loved One&apos;s Voice
            </span>
            <p className="mt-1 text-[11px] text-starlight/70 max-w-[200px]">
              Mom, Dad, or grandparents reading bedtime tales in their familiar voice
            </p>
          </div>
        </div>
      ) : (
        /* ── Compact Variant: Single Horizontal Scroll Row ── */
        <div className="relative flex items-center min-w-0 w-full">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              voiceRowRef.current?.scrollBy({ left: -160, behavior: "smooth" });
            }}
            className="hidden sm:flex items-center justify-center h-7 w-7 rounded-full bg-dusk/80 border border-starlight/20 text-starlight/80 hover:text-parchment hover:border-lamp/60 transition-all shrink-0 mr-1.5 cursor-pointer"
            aria-label="Scroll voices left"
          >
            <ChevronLeft size={15} />
          </button>
          <div
            ref={voiceRowRef}
            className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 px-1 max-w-full scroll-smooth flex-1 min-w-0"
            role="group"
            aria-label="Narrator Voices"
          >
            {allVoices.map((v, idx) => {
              const isSelected = value === v.id;
              const IconComponent = v.isCustom ? Heart : VOICE_ICONS[v.id] || Volume2;

              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleSelect(v.id)}
                  onFocus={(e) => {
                    if (value !== v.id) {
                      handleSelect(v.id);
                    }
                    if (typeof e.target?.scrollIntoView === "function") {
                      e.target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      e.stopPropagation();
                      const buttons = voiceRowRef.current?.querySelectorAll("button");
                      const nextBtn = buttons?.[idx + 1];
                      if (nextBtn) {
                        nextBtn.focus();
                        nextBtn.scrollIntoView?.({ behavior: "smooth", inline: "center", block: "nearest" });
                      }
                    } else if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      e.stopPropagation();
                      const buttons = voiceRowRef.current?.querySelectorAll("button");
                      const prevBtn = buttons?.[idx - 1];
                      if (prevBtn) {
                        prevBtn.focus();
                        prevBtn.scrollIntoView?.({ behavior: "smooth", inline: "center", block: "nearest" });
                      }
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onNavigateUp) onNavigateUp();
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onNavigateDown) onNavigateDown();
                    }
                  }}
                  style={{ outline: "none" }}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium shrink-0 transition-all cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-dusk ${
                    isSelected
                      ? "border-lamp/80 bg-lamp/25 text-parchment shadow-md shadow-lamp/15 font-semibold"
                      : "border-starlight/20 bg-dusk/70 text-starlight hover:border-starlight/40 hover:text-parchment"
                  }`}
                  aria-pressed={isSelected}
                >
                  <IconComponent className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-lamp" : "text-starlight/70"}`} />
                  <div className="shrink-0">
                    <div className="font-serif text-xs font-medium text-parchment flex items-center gap-1 whitespace-nowrap">
                      <span>{v.displayName || v.name}</span>
                      {v.isCustom && <span className="text-[9px] text-rose-300">⭐</span>}
                    </div>
                    <div className="text-[10px] text-starlight/70 whitespace-nowrap">{v.tagline}</div>
                  </div>
                </button>
              );
            })}
            <button
              type="button"
              data-testid="compact-record-family-voice-btn"
              onClick={() => setIsStudioOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  e.stopPropagation();
                  const buttons = voiceRowRef.current?.querySelectorAll("button");
                  const prevBtn = buttons?.[allVoices.length - 1];
                  if (prevBtn) {
                    prevBtn.focus();
                    prevBtn.scrollIntoView?.({ behavior: "smooth", inline: "center", block: "nearest" });
                  }
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onNavigateUp) onNavigateUp();
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onNavigateDown) onNavigateDown();
                }
              }}
              style={{ outline: "none" }}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-lamp/40 bg-panel/30 px-3 py-2.5 text-xs text-lamp hover:border-lamp hover:bg-panel/60 transition-all shrink-0 cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-dusk"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap font-medium">+ Record Voice</span>
            </button>
          </div>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              voiceRowRef.current?.scrollBy({ left: 160, behavior: "smooth" });
            }}
            className="hidden sm:flex items-center justify-center h-7 w-7 rounded-full bg-dusk/80 border border-starlight/20 text-starlight/80 hover:text-parchment hover:border-lamp/60 transition-all shrink-0 ml-1.5 cursor-pointer"
            aria-label="Scroll voices right"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* Voice Studio Recording Modal */}
      <FamilyVoiceStudioModal
        isOpen={isStudioOpen}
        onClose={() => setIsStudioOpen(false)}
        onVoiceCreated={handleVoiceCreated}
      />
    </div>
  );
}

