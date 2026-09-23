import { useEffect, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import { Volume2, VolumeX, Sparkles, Compass, Home, Moon, Mic, MicOff, Heart } from "lucide-react";
import AmbientParticles from "./AmbientParticles";
import { useSpeechRecognition } from "../utils/useSpeechRecognition";
import { loadCustomVoices } from "../utils/customVoices";
import "swiper/css";
import "swiper/css/navigation";

/**
 * IllustrationImage — renders the page illustration with a graceful fallback.
 * If the image URL is broken or the Bedrock call timed out, it shows the
 * animated "Painting Page…" placeholder instead of a blank or broken image.
 */
function IllustrationImage({ src, idx, kenBurnsClass, windDown }) {
  const [errored, setErrored] = useState(false);

  // Reset error state when the src changes (new illustration arrived)
  useEffect(() => { setErrored(false); }, [src]);

  if (errored) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-dusk/60 via-night/80 to-dusk/90 overflow-hidden p-4">
        <div className="absolute inset-0 bg-radial-at-c from-lamp/10 via-transparent to-transparent animate-pulse" />
        <AmbientParticles count={10} windDown={windDown} />
        <div className="relative z-10 flex flex-col items-center gap-2 sm:gap-3 px-4 text-center">
          <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-lamp/15 border border-lamp/30 shadow-lg shadow-lamp/10 text-lamp animate-bounce duration-1000">
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </div>
          <span className="font-serif text-base sm:text-lg md:text-xl italic text-starlight/80 tracking-wide">Painting scene…</span>
          <span className="text-[10px] sm:text-xs uppercase font-sans tracking-widest text-lamp/70 font-semibold">Page {idx + 1}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Blurred backdrop fills letterbox gaps on mobile */}
      <img src={src} alt="" aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl opacity-60 select-none md:hidden" />
      {/* Main illustration — object-contain mobile, object-cover desktop */}
      <img
        src={src}
        alt={`Illustration for page ${idx + 1}`}
        className={`absolute inset-0 h-full w-full object-contain sm:object-cover ${kenBurnsClass} transition-opacity duration-700 select-none`}
        onError={() => setErrored(true)}
      />
    </>
  );
}

// Detects "mobile, portrait" (narrower than Tailwind's `sm` breakpoint, taller than wide).
// The existing card layout below is already responsive for tablet/desktop and for phones
// held sideways, where there's enough width for an image-beside-text card. On a phone held
// upright there just isn't room for that: the illustration box shrinks to a sliver. Rather
// than layering more `sm:`/`landscape:` utilities on the same markup (which is how the
// flex-vs-grid conflict happened before), this drives a genuinely different layout — a
// full-bleed "picture book" page — via a small JS check instead of stacked CSS variants.
function useBookMode() {
  const [isBookMode, setIsBookMode] = useState(false);
  useEffect(() => {
    const check = () => {
      const isMobileWidth = window.innerWidth < 640; // below Tailwind's `sm`
      const isPortrait = window.innerHeight >= window.innerWidth;
      setIsBookMode(isMobileWidth && isPortrait);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);
  return isBookMode;
}

export default function StoryScreen({
  pages,
  illustrations = [],
  pageIndex,
  turnKey,
  onTurn,
  isNarrating = false,
  onToggleNarration,
  lesson = "",
  choices = [],
  chapter = 1,
  nextStoredChapterNumber = null,
  onContinueNextStoredChapter,
  onSelectChoice,
  onReturnHome,
  focusIndex = 0,
  onFocusIndexChange,
  activeSpeechMark = null,
  windDown = false,
  voice = "Joanna",
}) {
  const swiperRef = useRef(null);
  const activeWordRef = useRef(null);
  const hasConclusion = Boolean(nextStoredChapterNumber || lesson || (choices && choices.length > 0));

  useEffect(() => {
    if (activeWordRef.current) {
      // Keep the spoken word roughly in the center of the text container
      activeWordRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
  }, [activeSpeechMark]);

  useEffect(() => {
    // When turnKey or pageIndex changes, ensure scroll containers start at the top
    const scrollContainers = document.querySelectorAll(".story-page-scroll");
    scrollContainers.forEach((el) => {
      el.scrollTop = 0;
    });
  }, [turnKey, pageIndex]);
  const isBookMode = useBookMode();
  const totalSlides = pages.length + (hasConclusion ? 1 : 0);

  const [isPlayingLovedOne, setIsPlayingLovedOne] = useState(false);
  const lovedOneAudioRef = useRef(null);

  const customVoiceProfile = voice && voice.startsWith("custom")
    ? loadCustomVoices().find((cv) => cv.id === voice)
    : null;
  const narratorLabel = customVoiceProfile
    ? (customVoiceProfile.displayName || customVoiceProfile.name)
    : voice;
  const narratorAvatar = customVoiceProfile?.avatar || "";

  const toggleLovedOneMessage = () => {
    if (!customVoiceProfile?.audioDataUrl) return;
    if (isPlayingLovedOne && lovedOneAudioRef.current) {
      try { lovedOneAudioRef.current.pause(); } catch (e) {}
      lovedOneAudioRef.current.currentTime = 0;
      setIsPlayingLovedOne(false);
      return;
    }

    if (isNarrating && onToggleNarration) {
      onToggleNarration(); // pause page narration while playing personal message
    }

    if (!lovedOneAudioRef.current) {
      lovedOneAudioRef.current = new Audio(customVoiceProfile.audioDataUrl);
      lovedOneAudioRef.current.onended = () => setIsPlayingLovedOne(false);
      lovedOneAudioRef.current.onerror = () => setIsPlayingLovedOne(false);
    }
    lovedOneAudioRef.current.currentTime = 0;
    try {
      const p = lovedOneAudioRef.current.play();
      if (p && typeof p.then === "function") {
        p.then(() => setIsPlayingLovedOne(true)).catch(() => setIsPlayingLovedOne(false));
      } else {
        setIsPlayingLovedOne(true);
      }
    } catch (e) {
      setIsPlayingLovedOne(false);
    }
  };

  useEffect(() => {
    return () => {
      if (lovedOneAudioRef.current) {
        try { lovedOneAudioRef.current.pause(); } catch (e) {}
        lovedOneAudioRef.current = null;
      }
    };
  }, []);

  const [customTwist, setCustomTwist] = useState("");
  const twistSpeech = useSpeechRecognition({
    onResult: (text) => setCustomTwist(text),
  });

  // Sync Swiper with pageIndex when it changes from parent
  useEffect(() => {
    if (swiperRef.current && swiperRef.current.swiper) {
      swiperRef.current.swiper.slideTo(pageIndex, 0);
    }
  }, [pageIndex]);

  // Keep DOM focus synchronized with focusIndex on the conclusion slide for Fire TV remote
  useEffect(() => {
    if (pageIndex >= pages.length) {
      let targetId = "return-home-btn";
      if (nextStoredChapterNumber) {
        targetId = focusIndex === 0 ? "next-stored-chapter-btn" : "return-home-btn";
      } else {
        const numChoices = choices ? choices.length : 0;
        const hasVoice = twistSpeech.isSupported;
        const voiceIndex = hasVoice ? numChoices : -1;
        if (focusIndex < numChoices) {
          targetId = `choice-btn-${focusIndex}`;
        } else if (hasVoice && focusIndex === voiceIndex) {
          targetId = customTwist ? "weave-twist-btn" : "voice-twist-btn";
        } else {
          targetId = "return-home-btn";
        }
      }
      const el = document.getElementById(targetId);
      if (el && typeof el.focus === "function") {
        el.focus();
      }
    }
  }, [pageIndex, pages.length, focusIndex, choices, nextStoredChapterNumber, twistSpeech.isSupported, customTwist]);

  const handleSlideChange = (swiper) => {
    onTurn(swiper.activeIndex);
  };

  return (
    // h-dvh (dynamic viewport height) instead of h-screen: on mobile browsers h-screen
    // is measured against the *largest* possible viewport, so content gets clipped
    // behind the address bar / home-indicator when the chrome is showing. h-screen is
    // kept as a fallback for older browsers that don't support dvh.
    <div data-testid="story-screen" className="relative z-10 flex h-screen h-dvh w-full items-center justify-center">
      {/* Bedtime Dimmer Veil (Wind-Down Routine) */}
      {windDown && (
        <div
          data-testid="bedtime-dimmer-veil"
          className="pointer-events-none fixed inset-0 z-20 bg-night/25 backdrop-blur-[0.5px] transition-opacity duration-1000"
        />
      )}
      {/* Bedtime Wind-Down indicator */}
      {windDown && (
        <div
          data-testid="wind-down-badge"
          className="absolute top-3 left-3 sm:top-6 sm:left-8 z-30 flex items-center gap-1.5 sm:gap-2 rounded-full border border-lamp/30 bg-night/80 px-2.5 sm:px-3.5 py-1 sm:py-1.5 font-sans text-[10px] sm:text-xs font-medium text-lamp backdrop-blur-md shadow-lg shadow-black/40 animate-fade-in"
        >
          <Moon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-lamp fill-lamp/20" />
          <span className="tracking-wide">Bedtime Wind-Down</span>
        </div>
      )}

      {/* Audio controls: Loved one's voice greeting + Narration toggle */}
      <div className="absolute top-3 right-3 sm:top-6 sm:right-8 z-30 flex items-center gap-2">
        {customVoiceProfile?.audioDataUrl && (
          <button
            type="button"
            onClick={toggleLovedOneMessage}
            aria-label={isPlayingLovedOne ? "Stop personal voice message" : `Play ${narratorLabel}'s voice message`}
            title={`Listen to ${narratorLabel}'s bedtime voice recording`}
            className={`flex items-center gap-1.5 sm:gap-2 rounded-full border px-2.5 sm:px-3.5 py-1 sm:py-2 font-sans text-xs sm:text-sm backdrop-blur-sm transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-rose-400/50 cursor-pointer ${
              isPlayingLovedOne
                ? "border-rose-400 bg-rose-950/80 text-rose-200 font-semibold ring-2 ring-rose-400/40"
                : "border-rose-500/30 bg-panel/80 text-rose-300 hover:border-rose-400/60 hover:text-rose-100"
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${isPlayingLovedOne ? "fill-rose-400 text-rose-400 animate-pulse" : "text-rose-400"}`} />
            <span className="hidden sm:inline">
              {isPlayingLovedOne ? `Playing ${narratorLabel}...` : `${narratorLabel}'s Voice`}
            </span>
          </button>
        )}

        {onToggleNarration && (
          <button
            onClick={onToggleNarration}
            aria-label={isNarrating ? "Pause narration" : "Play narration"}
            title={isNarrating ? `Click to pause ${narratorLabel} narration` : `Click to play ${narratorLabel} narration`}
            className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-starlight/20 bg-panel/70 px-2.5 sm:px-4 py-1 sm:py-2 font-sans text-xs sm:text-sm text-starlight hover:bg-panel/90 hover:text-parchment backdrop-blur-sm transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-lamp/50 cursor-pointer"
          >
            {isNarrating ? (
              <>
                <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-lamp animate-pulse" />
                <span className="hidden sm:inline">Reading aloud</span>
                {narratorAvatar && <span className="text-xs">{narratorAvatar}</span>}
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-starlight/60" />
                <span>Listen</span>
              </>
            )}
          </button>
        )}
      </div>

      <Swiper
        ref={swiperRef}
        modules={[Navigation]}
        keyboard={{ enabled: false }}
        onSlideChange={handleSlideChange}
        initialSlide={pageIndex}
        className="h-full w-full"
      >
        {pages.map((page, idx) => {
          const pageText = typeof page === "object" ? page.text : page; // keep backward compat
          const illustrationUrl = illustrations[idx] || (typeof page === "object" && page.illustration ? page.illustration.url : null);
          const kenBurnsClass = `animate-kenburns-${idx % 4}`;

          const pageTextEl = (
            <>
              {activeSpeechMark &&
                idx === pageIndex &&
                typeof activeSpeechMark.start === "number" &&
                typeof activeSpeechMark.end === "number" &&
                activeSpeechMark.end <= pageText.length ? (
                <>
                  <span>{pageText.slice(0, activeSpeechMark.start)}</span>
                  <span
                    ref={activeWordRef}
                    data-testid="karaoke-word"
                    className="text-lamp font-semibold drop-shadow-[0_0_14px_rgba(232,163,61,0.85)] bg-lamp/15 px-1 py-0.5 rounded transition-all duration-150"
                  >
                    {pageText.slice(activeSpeechMark.start, activeSpeechMark.end)}
                  </span>
                  <span className="opacity-80">{pageText.slice(activeSpeechMark.end)}</span>
                </>
              ) : (
                pageText
              )}
            </>
          );

          const illustrationLayer = illustrationUrl ? (
            <>
              <IllustrationImage
                src={illustrationUrl}
                idx={idx}
                kenBurnsClass={kenBurnsClass}
                windDown={windDown}
              />
              {/* Ambient floating stardust & firefly motes */}
              <AmbientParticles count={14} windDown={windDown} />
            </>
          ) : (
            <div className="relative flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-dusk/60 via-night/80 to-dusk/90 overflow-hidden p-4">
              <div className="absolute inset-0 bg-radial-at-c from-lamp/10 via-transparent to-transparent animate-pulse" />
              <AmbientParticles count={10} windDown={windDown} />
              <div className="relative z-10 flex flex-col items-center gap-2 sm:gap-3 px-4 text-center">
                <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-lamp/15 border border-lamp/30 shadow-lg shadow-lamp/10 text-lamp animate-bounce duration-1000">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                <span className="font-serif text-base sm:text-lg md:text-xl italic text-starlight/80 tracking-wide">
                  Bringing scene to life&hellip;
                </span>
                <span className="text-[10px] sm:text-xs uppercase font-sans tracking-widest text-lamp/70 font-semibold">
                  Painting Page {idx + 1}
                </span>
              </div>
            </div>
          );

          return (
            <SwiperSlide
              key={idx}
              className={
                isBookMode
                  ? "flex items-stretch justify-center p-0"
                  : "flex items-center justify-center p-2.5 pt-12 pb-3 sm:p-6 sm:pt-16 sm:pb-10 md:px-14 md:py-12"
              }
            >
              {isBookMode ? (
                /*
                  Picture-book layout for mobile portrait: a full-bleed illustration edge to
                  edge at the top (no card border eating into it) and the text on a page-like
                  panel underneath that overlaps the image slightly, like a lifted page corner.
                  Dot pagination replaces the "Page X of Y" text, which sits outside this card
                  and would otherwise float disconnected from the page below it.
                */
                <div className="flex h-full w-full flex-col">
                  <div className="relative h-[54vh] min-h-0 w-full shrink-0 overflow-hidden bg-dusk/40">
                    {illustrationLayer}
                    {/* Scrim so the top-corner Listen / wind-down chrome stays legible over any illustration */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-night/60 to-transparent" />
                    <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.35)]" />
                  </div>

                  <div className="relative -mt-6 flex flex-1 min-h-0 flex-col rounded-t-[2rem] bg-panel/95 px-5 pt-6 pb-3 shadow-[0_-12px_30px_rgba(0,0,0,0.35)]">
                    <div className="story-page-scroll flex flex-1 min-h-0 flex-col overflow-y-auto px-1 py-1">
                      <p
                        key={turnKey}
                        data-testid="page-text"
                        className={`my-auto animate-page-in font-serif text-lg leading-relaxed text-center w-full transition-colors duration-1000 ${windDown ? "text-parchment/85" : "text-parchment"
                          }`}
                      >
                        {pageTextEl}
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-3 pb-1">
                      {Array.from({ length: totalSlides }).map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label={`Go to page ${i + 1}`}
                          onClick={() => swiperRef.current && swiperRef.current.swiper && swiperRef.current.swiper.slideTo(i)}
                          className={`h-1.5 rounded-full transition-all cursor-pointer ${i === pageIndex ? "w-5 bg-lamp" : "w-1.5 bg-starlight/30"
                            }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /*
                  Layout fix: `landscape:` and `md:` utilities used to be applied independently
                  (flex-col / landscape:flex-row / md:grid), which meant a landscape TABLET
                  (width >= 768px, orientation landscape) matched both `landscape:flex-row` and
                  `md:grid` at once — flex and grid both set `display`, so the result depended on
                  Tailwind's generated CSS order rather than intent. Scoping the landscape variant
                  to `max-md:` means "landscape phone" gets the side-by-side treatment, while the
                  `md:` breakpoint (tablet/desktop, any orientation) always uses the grid layout.
                */
                <div className="flex flex-col max-md:landscape:flex-row md:grid md:grid-cols-2 h-full max-h-[92vh] md:max-h-[38rem] w-full max-w-6xl min-h-0 overflow-hidden rounded-xl md:rounded-sm bg-panel/60 shadow-2xl shadow-black/40 backdrop-blur-sm">
                  {/* Illustration column with Ken Burns cinematic camera movement and ambient particles */}
                  <div
                    className="relative h-56 xs:h-64 sm:h-80 max-md:landscape:h-full max-md:landscape:w-1/2
                      md:w-full md:h-full w-full min-h-0 overflow-hidden bg-dusk/40 shrink-0 md:shrink"
                  >
                    {illustrationLayer}
                    {/* Soft inner edge so the image reads as part of the page, not a pasted photo */}
                    <div className="pointer-events-none absolute inset-0 z-20 shadow-[inset_0_0_40px_rgba(0,0,0,0.35)]" />
                  </div>

                  {/* Text column — centered vertically with my-auto so overflowing text scrolls safely from the top */}
                  <div
                    className="story-page-scroll flex flex-col flex-1 h-full w-full max-md:landscape:w-1/2 md:w-full min-h-0
                      px-4 py-4 sm:px-8 sm:py-6 md:px-12 md:py-8 lg:px-16 text-center overflow-y-auto"
                  >
                    <p
                      key={turnKey}
                      data-testid="page-text"
                      className={`my-auto animate-page-in font-serif leading-relaxed text-center w-full transition-colors duration-1000
                        text-base max-md:landscape:text-sm sm:text-xl md:text-2xl lg:text-3xl
                        ${windDown ? "text-parchment/85" : "text-parchment"}`}
                    >
                      {pageTextEl}
                    </p>
                  </div>
                </div>
              )}
            </SwiperSlide>
          );
        })}

        {/* Feature 8: Animated 'Continue the adventure' cue on the last story page */}
        {hasConclusion && pageIndex === pages.length - 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-16 sm:bottom-12 z-30 flex justify-center">
            <button
              type="button"
              onClick={() => onTurn && onTurn(pages.length)}
              className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full bg-lamp text-night font-sans text-xs sm:text-sm font-bold shadow-lg shadow-lamp/40 animate-bounce cursor-pointer hover:scale-105 transition-transform"
              aria-label="Continue to adventure choices"
            >
              <span>Continue the adventure</span>
              <span className="text-base">→</span>
            </button>
          </div>
        )}

        {/* Conclusion, Bedtime Lesson & Interactive Next Chapter Choices Slide */}
        {hasConclusion && (
          <SwiperSlide
            key="conclusion"
            className={
              isBookMode
                ? "flex items-stretch justify-center p-0 min-h-0"
                : "flex items-center justify-center p-3 pt-12 pb-12 sm:p-6 sm:pt-16 sm:pb-8 md:px-10 md:py-10 min-h-0"
            }
          >
            <div
              data-testid="story-conclusion"
              className={
                isBookMode
                  ? "flex flex-col items-center justify-start gap-y-4 w-full h-full min-h-0 pt-16 pb-4 px-5 rounded-t-[2rem] bg-panel/95 text-center overflow-y-auto"
                  : "flex flex-col items-center justify-start gap-y-4 sm:gap-y-5 w-full max-w-4xl h-full max-h-[88vh] md:max-h-[38rem] min-h-0 p-4 sm:p-6 md:p-8 rounded-xl bg-panel/75 border border-starlight/20 shadow-2xl shadow-black/50 backdrop-blur-md text-center overflow-y-auto"
              }
            >
              {/* Header */}
              <div className="flex flex-col items-center gap-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-lamp/20 border border-lamp/40 text-lamp text-[10px] sm:text-xs font-sans uppercase tracking-widest font-semibold">
                  <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  Chapter {chapter} Complete
                </span>
                <h2 className="font-serif text-xl sm:text-3xl md:text-4xl font-bold text-parchment mt-0.5">
                  {nextStoredChapterNumber ? `Ready for Chapter ${nextStoredChapterNumber}?` : "The End"}
                </h2>
              </div>

              {/* Bedtime Lesson to Learn */}
              {lesson && (
                <div
                  data-testid="story-lesson"
                  className="w-full max-w-2xl rounded-xl bg-dusk/60 border border-lamp/30 p-3 sm:p-4 md:p-5 shadow-inner text-center"
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1 text-lamp font-sans text-xs md:text-sm tracking-wider uppercase font-semibold">
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-lamp animate-pulse" />
                    <span>Tonight&apos;s Lesson to Learn</span>
                  </div>
                  <p className="font-serif italic text-sm sm:text-lg md:text-xl text-parchment leading-relaxed">
                    &ldquo;{lesson}&rdquo;
                  </p>
                </div>
              )}

              {/* Next Stored Chapter Action (Fast Path) */}
              {nextStoredChapterNumber ? (
                <div className="w-full max-w-xl">
                  <button
                    id="next-stored-chapter-btn"
                    data-testid="next-stored-chapter-btn"
                    onClick={onContinueNextStoredChapter}
                    onMouseEnter={() => onFocusIndexChange && onFocusIndexChange(0)}
                    className={`group relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 w-full p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl transition-all duration-200 shadow-xl cursor-pointer ${pageIndex >= pages.length && focusIndex === 0
                      ? "border-2 border-lamp bg-panel ring-4 ring-lamp/80 shadow-lamp/30 -translate-y-1 scale-[1.02]"
                      : "border border-lamp/40 bg-panel/90 hover:border-lamp hover:bg-panel"
                      }`}
                  >
                    <div className="flex flex-col text-left">
                      <span className="font-sans text-[10px] sm:text-xs font-bold uppercase tracking-wider text-lamp mb-0.5">
                        Saved Chapter Available
                      </span>
                      <span className="font-serif text-lg sm:text-xl md:text-2xl font-bold text-parchment group-hover:text-white">
                        Continue to Chapter {nextStoredChapterNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-sans text-xs sm:text-sm md:text-base font-semibold text-lamp group-hover:translate-x-1.5 transition-transform">
                      <span>Read Chapter {nextStoredChapterNumber}</span>
                      <span className="text-lg sm:text-xl">&rarr;</span>
                    </div>
                  </button>
                </div>
              ) : (
                /* Next Adventure Frontier Choices (AI Generation) */
                choices && choices.length > 0 && (
                  <div className="w-full max-w-3xl">
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-4 sm:mb-3 text-starlight/80 font-sans text-xs md:text-sm uppercase tracking-wider font-semibold">
                      <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-lamp" />
                      <span>What should happen in the next adventure?</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3.5">
                      {choices.map((choice, cIdx) => {
                        const isFocused = pageIndex >= pages.length && focusIndex === cIdx;
                        return (
                          <button
                            key={cIdx}
                            id={`choice-btn-${cIdx}`}
                            data-testid={`choice-btn-${cIdx}`}
                            onClick={() => onSelectChoice && onSelectChoice(choice)}
                            onMouseEnter={() => onFocusIndexChange && onFocusIndexChange(cIdx)}
                            className={`group relative flex flex-col items-start text-left p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl transition-all duration-200 shadow-lg cursor-pointer ${isFocused
                              ? "border-2 border-lamp bg-panel ring-4 ring-lamp/80 shadow-lamp/30 -translate-y-1 scale-[1.01]"
                              : "border border-starlight/25 bg-panel/90 hover:border-lamp hover:bg-panel"
                              }`}
                          >
                            <div className="flex items-center justify-between w-full mb-1">
                              <span className="font-sans text-[10px] sm:text-xs font-bold uppercase tracking-wider text-lamp">
                                Choice {cIdx + 1}
                              </span>
                              <span className="font-sans text-[10px] sm:text-xs text-starlight/60 group-hover:text-lamp transition-colors">
                                Continue &rarr;
                              </span>
                            </div>
                            <p className="font-serif text-sm sm:text-base md:text-lg text-parchment group-hover:text-white leading-snug">
                              {choice}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Tell the TV what to do next (Voice Twist Dictation) */}
                    {twistSpeech.isSupported && (
                      <div className="mt-3 flex flex-col items-center gap-2">
                        {(() => {
                          const numChoices = choices ? choices.length : 0;
                          const isVoiceFocused = pageIndex >= pages.length && focusIndex === numChoices;
                          return (
                            <>
                              <button
                                type="button"
                                id="voice-twist-btn"
                                data-testid="voice-twist-btn"
                                onClick={twistSpeech.toggleListening}
                                onMouseEnter={() => onFocusIndexChange && onFocusIndexChange(numChoices)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full font-sans text-xs font-semibold tracking-wide transition-all cursor-pointer ${twistSpeech.isListening
                                  ? "bg-lamp text-night animate-pulse shadow-lg shadow-lamp/50 scale-105 ring-4 ring-lamp/80"
                                  : isVoiceFocused && !customTwist
                                  ? "border-2 border-lamp bg-panel text-lamp ring-4 ring-lamp/80 shadow-lamp/30 scale-105"
                                  : "bg-panel/90 text-lamp border border-lamp/40 hover:bg-lamp/20"
                                  }`}
                              >
                                {twistSpeech.isListening ? (
                                  <>
                                    <MicOff size={15} />
                                    <span>Listening... speak your twist</span>
                                  </>
                                ) : (
                                  <>
                                    <Mic size={15} />
                                    <span>Tell the TV what to do next (Voice)</span>
                                  </>
                                )}
                              </button>
                              {customTwist && (
                                <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-panel/80 border border-lamp/30 animate-fade-in">
                                  <span className="font-serif italic text-sm text-parchment">&ldquo;{customTwist}&rdquo;</span>
                                  <button
                                    type="button"
                                    id="weave-twist-btn"
                                    data-testid="weave-twist-btn"
                                    onClick={() => onSelectChoice && onSelectChoice(customTwist)}
                                    onMouseEnter={() => onFocusIndexChange && onFocusIndexChange(numChoices)}
                                    className={`px-3 py-1.5 rounded-lg bg-lamp text-night font-sans font-bold text-xs hover:bg-lamp/90 cursor-pointer shadow transition-all ${isVoiceFocused
                                      ? "ring-4 ring-lamp/90 scale-105 border border-white"
                                      : ""
                                      }`}
                                  >
                                    Weave Twist &rarr;
                                  </button>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )
              )}

              {/*
                Fix: the old `-mt-16 sm:mt-3` negative-margin hack was pulling this button
                up over the choice grid on mobile to compensate for stacked content height —
                a fragile trick that overlaps buttons whenever there are 2 choices instead of
                the layout's assumed count, or on unusually short viewports. The parent uses
                `justify-between` and is scrollable (`overflow-y-auto`), so `mt-auto` lets it
                sit naturally at the bottom without any manual offset or risk of overlap.
              */}
              <div className="mt-auto pt-2 border-t border-starlight/10 w-full flex justify-center shrink-0">
                {(() => {
                  const numChoices = choices ? choices.length : 0;
                  const voiceOffset = twistSpeech.isSupported ? 1 : 0;
                  const targetHomeIndex = nextStoredChapterNumber ? 1 : (numChoices + voiceOffset);
                  const isHomeFocused = pageIndex >= pages.length && focusIndex === targetHomeIndex;
                  return (
                    <button
                      id="return-home-btn"
                      data-testid="return-home-btn"
                      onClick={onReturnHome}
                      onMouseEnter={() => onFocusIndexChange && onFocusIndexChange(targetHomeIndex)}
                      className={`flex items-center gap-2 rounded-full px-5 py-2 text-xs md:text-sm font-sans transition-all cursor-pointer ${isHomeFocused
                        ? "border border-lamp bg-starlight/20 text-parchment ring-2 ring-lamp/80 scale-[1.03]"
                        : "border border-transparent text-starlight/70 hover:text-parchment hover:bg-starlight/10 hover:border-starlight/20"
                        }`}
                    >
                      <Home className="w-4 h-4" />
                      <span>Return to Home &amp; Start a New Story</span>
                    </button>
                  );
                })()}
              </div>
            </div>
          </SwiperSlide>
        )}
      </Swiper>

      {/* Decorative ellipse below card */}
      <div
        className="pointer-events-none absolute top-[55%] h-[40vh] w-[80vw] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #7C93C9 0%, transparent 70%)" }}
      />

      {/* Page indicator — hidden in book mode, where dot pagination inside the page panel replaces it */}
      {!isBookMode && (
        <div className="pointer-events-none absolute bottom-10 sm:bottom-8 max-md:landscape:bottom-2 left-1/2 z-20 -translate-x-1/2 font-sans text-xs sm:text-sm text-starlight/70">
          {pageIndex >= pages.length
            ? `Ch. ${chapter} • The End`
            : `Ch. ${chapter} • Page ${pageIndex + 1} of ${pages.length}`}
        </div>
      )}
    </div>
  );
}