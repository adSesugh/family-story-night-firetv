import React from "react";
import { ArrowLeft, CogIcon, History, BookOpen, Sparkles, Mic, MicOff, Feather, Trees, Rocket, Moon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useSpeechRecognition } from "../utils/useSpeechRecognition";
import { isFireTVDevice } from "../utils/device";
import { CANONICAL_BIBLE_STORIES, normalizeCategory } from "../constants/themes";

const CATEGORY_ICONS = {
  adventures: Sparkles,
  bible: BookOpen,
  fables: Feather,
  nature: Trees,
  science: Rocket,
  calm: Moon,
};

function formatSpeechError(error) {
  if (!error) return null;
  const isFireTV = typeof navigator !== "undefined" && isFireTVDevice(navigator.userAgent);
  if (isFireTV) {
    return "Microphone is unavailable in Fire TV Web App Tester. Please select the input box and use the on-screen keyboard (or dictate via the Fire TV mobile app).";
  }
  if (error === "insecure-context") {
    return "Microphone requires HTTPS or localhost. Connecting via network HTTP (http://...) blocks microphone access in browsers.";
  }
  if (error === "not-allowed") {
    const isInsecure =
      typeof window !== "undefined" &&
      (window.isSecureContext === false ||
        (window.location &&
          window.location.protocol === "http:" &&
          window.location.hostname !== "localhost" &&
          window.location.hostname !== "127.0.0.1"));
    if (isInsecure) {
      return "Microphone blocked: Browser requires HTTPS or localhost. Connecting via network HTTP (http://...) blocks microphone access.";
    }
    return "Microphone access blocked. Please allow microphone permission in browser settings. (Tip: Speak naturally after clicking; do not hold the Alexa remote button).";
  }
  if (error === "no-speech") {
    return "No voice heard. Please try speaking closer to your microphone.";
  }
  return `Microphone notice: ${error}`;
}

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
  illustrationStyle = "watercolor",
  setIllustrationStyle,
  parentSettings,
  onOpenSettings,
  alexaPairingCode,
}) {
  const maxCustomThemeLength = 100;
  const allowCustomThemes = parentSettings?.settings?.allowCustomThemes !== false;
  const allowHistory = parentSettings?.settings?.allowHistory !== false;
  const activeThemeMode = allowCustomThemes ? themeMode : "preset";

  // --- Feature 6: Evening bedtime prompt ---
  const [bedtimeDismissed, setBedtimeDismissed] = React.useState(
    () => typeof sessionStorage !== "undefined" && !!sessionStorage.getItem("fsn_bedtime_dismissed")
  );
  const showBedtimeBanner = React.useMemo(() => {
    const h = new Date().getHours();
    return h >= 18 && h < 22 && !bedtimeDismissed;
  }, [bedtimeDismissed]);
  const dismissBedtimeBanner = () => {
    setBedtimeDismissed(true);
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem("fsn_bedtime_dismissed", "1");
  };



  const namesSpeech = useSpeechRecognition({
    onResult: (text) => setNames(text),
  });

  const themeSpeech = useSpeechRecognition({
    onResult: (text) => setCustomTheme && setCustomTheme(text.slice(0, maxCustomThemeLength)),
  });

  const activeBibleStory =
    category === "bible" && themes && themes.length > 0
      ? CANONICAL_BIBLE_STORIES.find((s) => s.title === themes[themeIndex]) ||
      CANONICAL_BIBLE_STORIES[themeIndex % CANONICAL_BIBLE_STORIES.length] ||
      CANONICAL_BIBLE_STORIES[0]
      : null;

  const settingsBtnRef = React.useRef(null);
  const namesInputRef = React.useRef(null);
  const namesXBtnRef = React.useRef(null);
  const namesMicBtnRef = React.useRef(null);
  const categoryTabsRef = React.useRef(null);
  const themeControlsRef = React.useRef(null);
  const customThemeRef = React.useRef(null);
  const themeXBtnRef = React.useRef(null);
  const themeMicBtnRef = React.useRef(null);
  const viewHistoryBtnRef = React.useRef(null);
  const beginStoryBtnRef = React.useRef(null);
  const storyLengthRef = React.useRef(null);

  React.useEffect(() => {
    if (categoryTabsRef.current) {
      const selectedBtn = categoryTabsRef.current.querySelector('[aria-selected="true"]');
      if (selectedBtn && typeof selectedBtn.scrollIntoView === "function") {
        selectedBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [category]);

  return (
    <div className="relative z-10 w-full max-w-4xl px-4 sm:px-8 md:px-12 py-6 sm:py-8 my-auto overflow-y-auto max-h-[95vh]">
      {/* Feature 6: Evening bedtime banner */}
      {showBedtimeBanner && (
        <div className="flex items-center justify-between gap-3 mb-4 px-4 py-2.5 rounded-xl bg-lamp/15 border border-lamp/30 animate-fade-in">
          <div className="flex items-center gap-2 font-sans text-sm text-parchment">
            <span className="text-lg">🌙</span>
            <span><strong>Good evening!</strong> Time for tonight&apos;s bedtime story.</span>
          </div>
          <button
            type="button"
            onClick={dismissBedtimeBanner}
            aria-label="Dismiss"
            className="text-starlight/60 hover:text-parchment transition-colors text-lg leading-none cursor-pointer p-1"
          >
            <X size={10} className="text-white" />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-3">
          <p className="font-sans text-sm sm:text-base md:text-lg text-starlight">Family Story Night</p>
          {alexaPairingCode && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-lamp/15 border border-lamp/30 px-2.5 py-0.5 font-sans text-xs text-lamp"
              title={`Alexa Voice Code: ${alexaPairingCode}`}
            >
              <Mic size={12} className="text-lamp animate-pulse" />
              <span>Alexa Code: <strong className="tracking-widest font-mono">{alexaPairingCode}</strong></span>
            </span>
          )}
        </div>
        {onOpenSettings && (
          <button
            ref={settingsBtnRef}
            type="button"
            onClick={onOpenSettings}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
                e.preventDefault();
                e.stopPropagation();
                namesInputRef.current?.focus();
              }
            }}
            style={{ outline: "none" }}
            className="flex items-center gap-1.5 rounded-sm bg-starlight/15 px-3 py-1.5 font-sans text-xs sm:text-sm text-starlight transition-colors hover:bg-starlight/25 hover:text-parchment cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-dusk"
            aria-label="Parent Settings"
          >
            <CogIcon size={16} /> Settings
          </button>
        )}
      </div>

      <h1 className="mt-1 font-serif text-3xl sm:text-4xl md:text-5xl leading-tight text-parchment">
        {category === "bible" ? "Who\u2019s listening tonight?" : "Who\u2019s in tonight\u2019s story?"}
      </h1>

      <div className="relative mt-6 sm:mt-10">
        <input
          ref={namesInputRef}
          className={`w-full rounded-sm border-b-2 border-starlight/40 bg-transparent px-1 py-2 sm:py-3 font-serif text-xl sm:text-2xl md:text-3xl text-parchment placeholder:text-starlight/50 focus:border-[#e8a33d] focus:outline-none ${namesSpeech.isSupported ? "pr-20" : names ? "pr-10" : "pr-12"
            }`}
          value={names}
          onChange={(e) => setNames(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              e.stopPropagation();
              settingsBtnRef.current?.focus();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              e.stopPropagation();
              const activeTab = categoryTabsRef.current?.querySelector('[aria-selected="true"]') ||
                categoryTabsRef.current?.querySelector('button');
              activeTab?.focus();
            } else if (e.key === "ArrowRight") {
              const isAtEnd = e.target.selectionEnd === e.target.value.length;
              if (isAtEnd) {
                e.preventDefault();
                e.stopPropagation();
                // X button first (if present), then mic
                if (names && namesXBtnRef.current) {
                  namesXBtnRef.current.focus();
                } else if (namesSpeech.isSupported) {
                  namesMicBtnRef.current?.focus();
                }
              }
            }
          }}
          placeholder={
            category === "bible"
              ? "(Optional) Maya, Dad..."
              : "Maya, Dad, Biscuit the dog"
          }
          autoFocus
        />
        {names && (
          <button
            ref={namesXBtnRef}
            type="button"
            onClick={() => { setNames(""); namesInputRef.current?.focus(); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                e.stopPropagation();
                namesInputRef.current?.focus();
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                e.stopPropagation();
                namesMicBtnRef.current?.focus();
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                e.stopPropagation();
                settingsBtnRef.current?.focus();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopPropagation();
                const activeTab = categoryTabsRef.current?.querySelector('[aria-selected="true"]') ||
                  categoryTabsRef.current?.querySelector('button');
                activeTab?.focus();
              }
            }}
            style={{ outline: "none" }}
            aria-label="Clear names"
            title="Clear"
            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center h-6 w-6 rounded-full bg-starlight/10 text-starlight/50 hover:bg-starlight/25 hover:text-parchment transition-all cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-dusk ${namesSpeech.isSupported ? "right-12" : "right-2"
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}
        {namesSpeech.isSupported && (
          <button
            ref={namesMicBtnRef}
            type="button"
            onClick={namesSpeech.toggleListening}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                e.stopPropagation();
                // Go to X button first (if present), else back to input
                if (names && namesXBtnRef.current) {
                  namesXBtnRef.current.focus();
                } else {
                  namesInputRef.current?.focus();
                }
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                e.stopPropagation();
                settingsBtnRef.current?.focus();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopPropagation();
                const activeTab = categoryTabsRef.current?.querySelector('[aria-selected="true"]') ||
                  categoryTabsRef.current?.querySelector('button');
                activeTab?.focus();
              }
            }}
            style={{ outline: "none" }}
            aria-label={namesSpeech.isListening ? "Stop listening" : "Speak names into remote"}
            title={namesSpeech.isListening ? "Listening... click to stop" : "Speak names with voice"}
            className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-9 w-9 rounded-full transition-all cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-dusk ${namesSpeech.isListening
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
          <span>
            {namesSpeech.transcript
              ? `Hearing: "${namesSpeech.transcript}"`
              : "Listening... speak names into your remote"}
          </span>
        </div>
      )}
      {namesSpeech.error && (
        <p className="mt-2 text-xs font-sans text-amber-300">
          {formatSpeechError(namesSpeech.error)}
        </p>
      )}
      {normalizeCategory(category) === "bible" && (
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
              <div className="flex items-center gap-1.5 mb-3 min-w-0">
                <span className="text-xs uppercase tracking-wider text-starlight/60 font-sans font-medium mr-1 shrink-0">
                  Collection:
                </span>
                <div className="relative flex items-center min-w-0 flex-1">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      categoryTabsRef.current?.scrollBy({ left: -160, behavior: "smooth" });
                    }}
                    className="hidden sm:flex items-center justify-center h-7 w-7 rounded-full bg-dusk/80 border border-starlight/20 text-starlight/80 hover:text-parchment hover:border-lamp/60 transition-all shrink-0 mr-1 cursor-pointer"
                    aria-label="Scroll collections left"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <div
                    ref={categoryTabsRef}
                    className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 px-1 max-w-full scroll-smooth"
                    role="tablist"
                    aria-label="Story Categories"
                  >
                    {categories.map((cat, idx) => {
                      const activeCatId = normalizeCategory(category);
                      const isSelected = activeCatId === cat.id;
                      const IconComponent = CATEGORY_ICONS[cat.id] || Sparkles;
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
                          onFocus={(e) => {
                            if (setCategory && activeCatId !== cat.id) {
                              setCategory(cat.id);
                              setThemeIndex(0);
                            }
                            if (typeof e.target?.scrollIntoView === "function") {
                              e.target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowRight") {
                              e.preventDefault();
                              e.stopPropagation();
                              const nextIdx = (idx + 1) % categories.length;
                              const nextCat = categories[nextIdx];
                              if (setCategory) {
                                setCategory(nextCat.id);
                                setThemeIndex(0);
                              }
                              const buttons = categoryTabsRef.current?.querySelectorAll('[role="tab"]');
                              const target = buttons?.[nextIdx];
                              target?.focus();
                              if (target && typeof target.scrollIntoView === "function") {
                                target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                              }
                            } else if (e.key === "ArrowLeft") {
                              e.preventDefault();
                              e.stopPropagation();
                              const prevIdx = (idx - 1 + categories.length) % categories.length;
                              const prevCat = categories[prevIdx];
                              if (setCategory) {
                                setCategory(prevCat.id);
                                setThemeIndex(0);
                              }
                              const buttons = categoryTabsRef.current?.querySelectorAll('[role="tab"]');
                              const target = buttons?.[prevIdx];
                              target?.focus();
                              if (target && typeof target.scrollIntoView === "function") {
                                target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                              }
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              e.stopPropagation();
                              namesInputRef.current?.focus();
                            } else if (e.key === "ArrowDown") {
                              e.preventDefault();
                              e.stopPropagation();
                              if (activeThemeMode === "custom") {
                                customThemeRef.current?.focus();
                              } else {
                                const themeBtn = themeControlsRef.current?.querySelector('button:not([tabindex="-1"])');
                                if (themeBtn) {
                                  themeBtn.focus();
                                } else {
                                  (viewHistoryBtnRef.current || beginStoryBtnRef.current)?.focus();
                                }
                              }
                            }
                          }}
                          style={{ outline: "none" }}
                          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-sans text-xs font-semibold shrink-0 transition-all cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-dusk ${isSelected
                            ? "bg-lamp/25 text-lamp border border-lamp/80 shadow-md shadow-lamp/15 font-bold"
                            : "bg-starlight/10 text-starlight/75 border border-transparent hover:bg-starlight/20 hover:text-parchment"
                            }`}
                        >
                          <IconComponent size={14} className="shrink-0" />
                          <span className="whitespace-nowrap">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      categoryTabsRef.current?.scrollBy({ left: 160, behavior: "smooth" });
                    }}
                    className="hidden sm:flex items-center justify-center h-7 w-7 rounded-full bg-dusk/80 border border-starlight/20 text-starlight/80 hover:text-parchment hover:border-lamp/60 transition-all shrink-0 ml-1 cursor-pointer"
                    aria-label="Scroll collections right"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}

            <div ref={themeControlsRef} className="mt-3 flex flex-wrap items-center gap-3 font-sans text-base">
              <span className="text-starlight text-sm shrink-0">
                {category === "bible" ? "Tonight\u2019s story" : "Tonight\u2019s theme"}
              </span>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setThemeIndex((i) => (i - 1 + themes.length) % themes.length)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      e.stopPropagation();
                      categoryTabsRef.current?.querySelector('[aria-selected="true"]')?.focus();
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      e.stopPropagation();
                      (storyLengthRef.current?.querySelector('[aria-pressed="true"]') ||
                        storyLengthRef.current?.querySelector("button") ||
                        viewHistoryBtnRef.current ||
                        beginStoryBtnRef.current)?.focus();
                    } else if (e.key === "ArrowRight") {
                      e.preventDefault();
                      e.stopPropagation();
                      themeControlsRef.current?.querySelectorAll("button")?.[1]?.focus();
                    }
                  }}
                  aria-label="Previous story theme"
                  title="Previous theme"
                  style={{ outline: "none" }}
                  className="flex items-center justify-center h-7 w-7 rounded-full bg-starlight/15 text-starlight hover:text-parchment hover:bg-starlight/25 transition-colors cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp"
                >
                  <ChevronLeft size={15} />
                </button>

                <span className="text-parchment font-serif text-lg md:text-xl font-medium tracking-wide px-1">
                  {themes[themeIndex]}
                </span>

                <button
                  type="button"
                  onClick={() => setThemeIndex((i) => (i + 1) % themes.length)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      e.stopPropagation();
                      categoryTabsRef.current?.querySelector('[aria-selected="true"]')?.focus();
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      e.stopPropagation();
                      (storyLengthRef.current?.querySelector('[aria-pressed="true"]') ||
                        storyLengthRef.current?.querySelector("button") ||
                        viewHistoryBtnRef.current ||
                        beginStoryBtnRef.current)?.focus();
                    } else if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      e.stopPropagation();
                      themeControlsRef.current?.querySelectorAll("button")?.[0]?.focus();
                    }
                  }}
                  aria-label="Next story theme"
                  title="Next theme"
                  style={{ outline: "none" }}
                  className="flex items-center justify-center h-7 w-7 rounded-full bg-starlight/15 text-starlight hover:text-parchment hover:bg-starlight/25 transition-colors cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp"
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              {activeBibleStory && (
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-lamp/15 text-lamp border border-lamp/30"
                  data-testid="bible-reference-badge"
                >
                  {activeBibleStory.reference}
                </span>
              )}
            </div>
            {activeBibleStory?.virtue && (
              <p className="mt-2 font-sans text-xs text-starlight/80" data-testid="bible-virtue-description">
                <span className="text-lamp/90 font-semibold">Virtue focus:</span> {activeBibleStory.virtue}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4">
            <div className="relative">
              <textarea
                ref={customThemeRef}
                value={customTheme}
                onChange={(e) =>
                  setCustomTheme && setCustomTheme(e.target.value.slice(0, maxCustomThemeLength))
                }
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    e.stopPropagation();
                    namesInputRef.current?.focus();
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    e.stopPropagation();
                    (storyLengthRef.current?.querySelector('[aria-pressed="true"]') ||
                      storyLengthRef.current?.querySelector("button") ||
                      viewHistoryBtnRef.current ||
                      beginStoryBtnRef.current)?.focus();
                  } else if (e.key === "ArrowRight") {
                    const isAtEnd = e.target.selectionEnd === e.target.value.length;
                    if (isAtEnd) {
                      e.preventDefault();
                      e.stopPropagation();
                      // X button first (if present), then mic
                      if (customTheme && themeXBtnRef.current) {
                        themeXBtnRef.current.focus();
                      } else if (themeSpeech.isSupported) {
                        themeMicBtnRef.current?.focus();
                      }
                    }
                  }
                }}
                placeholder="Describe your custom story theme..."
                maxLength={maxCustomThemeLength}
                className={`w-full rounded-sm border-b-2 border-starlight/40 bg-transparent px-1 py-3 font-serif text-base text-parchment placeholder:text-starlight/50 focus:border-[#e8a33d] focus:outline-none ${themeSpeech.isSupported ? "pr-20" : customTheme ? "pr-10" : "pr-12"
                  }`}
                rows="2"
              />
              {customTheme && (
                <button
                  ref={themeXBtnRef}
                  type="button"
                  onClick={() => { setCustomTheme && setCustomTheme(""); customThemeRef.current?.focus(); }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      e.stopPropagation();
                      customThemeRef.current?.focus();
                    } else if (e.key === "ArrowRight") {
                      e.preventDefault();
                      e.stopPropagation();
                      themeMicBtnRef.current?.focus();
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      e.stopPropagation();
                      namesInputRef.current?.focus();
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      e.stopPropagation();
                      (viewHistoryBtnRef.current || beginStoryBtnRef.current)?.focus();
                    }
                  }}
                  style={{ outline: "none" }}
                  aria-label="Clear custom theme"
                  title="Clear"
                  className={`absolute top-3 flex items-center justify-center h-6 w-6 rounded-full bg-starlight/10 text-starlight/50 hover:bg-starlight/25 hover:text-parchment transition-all cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-dusk ${themeSpeech.isSupported ? "right-12" : "right-2"
                    }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
              {themeSpeech.isSupported && (
                <button
                  ref={themeMicBtnRef}
                  type="button"
                  onClick={themeSpeech.toggleListening}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      e.stopPropagation();
                      // Go to X button first (if present), else back to textarea
                      if (customTheme && themeXBtnRef.current) {
                        themeXBtnRef.current.focus();
                      } else {
                        customThemeRef.current?.focus();
                      }
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      e.stopPropagation();
                      namesInputRef.current?.focus();
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      e.stopPropagation();
                      (viewHistoryBtnRef.current || beginStoryBtnRef.current)?.focus();
                    }
                  }}
                  style={{ outline: "none" }}
                  aria-label={themeSpeech.isListening ? "Stop listening" : "Speak custom theme into remote"}
                  title={themeSpeech.isListening ? "Listening... click to stop" : "Speak custom theme with voice"}
                  className={`absolute right-2 top-3 flex items-center justify-center h-8 w-8 rounded-full transition-all cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-dusk ${themeSpeech.isListening
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
                <span>
                  {themeSpeech.transcript
                    ? `Hearing: "${themeSpeech.transcript}"`
                    : "Listening... describe your story theme into your remote"}
                </span>
              </div>
            )}
            {themeSpeech.error && (
              <p className="mt-1 text-xs font-sans text-amber-300">
                {formatSpeechError(themeSpeech.error)}
              </p>
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

      {/* Story Length Selector */}
      <div ref={storyLengthRef} className="mt-5 sm:mt-6">
        <div className="flex items-center justify-between mb-2">
          <label className="font-sans text-xs uppercase tracking-wider text-starlight/80 font-semibold flex items-center gap-1.5">
            <span>Story Length</span>
          </label>
          <span className="font-sans text-[11px] text-lamp/90 font-medium">
            {Number(storyLength) === 3
              ? "🐣 Toddler (3 pages · ~2 min)"
              : Number(storyLength) === 9
              ? "🚀 Chapter Book (9 pages · ~8 min)"
              : "📖 Early Reader (6 pages · ~5 min)"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Toddler", ages: "2–4", length: 3, emoji: "🐣", desc: "~2 min" },
            { label: "Early Reader", ages: "5–7", length: 6, emoji: "📖", desc: "~5 min" },
            { label: "Chapter Book", ages: "8+", length: 9, emoji: "🚀", desc: "~8 min" },
          ].map(({ label, ages, length, emoji, desc }) => {
            const isSelected = Number(storyLength) === length;
            return (
              <button
                key={length}
                type="button"
                onClick={() => setStoryLength && setStoryLength(length)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    e.stopPropagation();
                    if (activeThemeMode === "custom") {
                      customThemeRef.current?.focus();
                    } else {
                      themeControlsRef.current?.querySelectorAll("button")?.[0]?.focus();
                    }
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    e.stopPropagation();
                    (viewHistoryBtnRef.current || beginStoryBtnRef.current)?.focus();
                  }
                }}
                aria-pressed={isSelected}
                aria-label={`Story Length: ${label} (${ages}), ${length} pages, ${desc}`}
                style={{ outline: "none" }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border font-sans text-xs font-semibold transition-all cursor-pointer focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-dusk ${
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

      {error && <p className="mt-6 font-sans text-base text-red-300">{error}</p>}
      {customThemeError && (
        <p className="mt-2 font-sans text-base text-red-300">{customThemeError}</p>
      )}




      <div className="flex flex-col sm:flex-row gap-3 mt-6 sm:mt-8">
        {allowHistory && hasHistory && (
          <button
            ref={viewHistoryBtnRef}
            type="button"
            onClick={onViewHistory}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                e.stopPropagation();
                beginStoryBtnRef.current?.focus();
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                e.stopPropagation();
                (storyLengthRef.current?.querySelector('[aria-pressed="true"]') ||
                  storyLengthRef.current?.querySelector("button") ||
                  themeControlsRef.current?.querySelectorAll("button")?.[0])?.focus();
              }
            }}
            style={{ outline: "none" }}
            className="flex justify-center gap-2 items-center rounded-sm bg-starlight/20 px-6 sm:px-8 py-2.5 font-sans text-base sm:text-lg font-medium text-parchment transition-transform hover:scale-[1.02] focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-dusk cursor-pointer w-full sm:w-auto"
          >
            <History size={16} /> View History
          </button>
        )}
        <button
          ref={beginStoryBtnRef}
          type="button"
          onClick={onSubmit}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" && allowHistory && hasHistory) {
              e.preventDefault();
              e.stopPropagation();
              viewHistoryBtnRef.current?.focus();
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              e.stopPropagation();
              (storyLengthRef.current?.querySelector('[aria-pressed="true"]') ||
                storyLengthRef.current?.querySelector("button") ||
                themeControlsRef.current?.querySelectorAll("button")?.[0])?.focus();
            }
          }}
          style={{ outline: "none" }}
          className="flex justify-center items-center rounded-sm bg-lamp px-6 sm:px-8 py-2.5 font-sans text-base sm:text-lg font-medium text-dusk transition-transform hover:scale-[1.02] focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lamp focus-visible:ring-offset-2 focus-visible:ring-offset-dusk cursor-pointer w-full sm:w-auto"
        >
          Begin the story
        </button>
      </div>
      {/* <p className="mt-3 font-sans text-xs sm:text-sm text-starlight/60">or press Enter</p> */}
    </div>
  );
}
