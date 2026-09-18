import { useEffect, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import { Volume2, VolumeX, Sparkles, Compass, Home, Moon, Mic, MicOff } from "lucide-react";
import AmbientParticles from "./AmbientParticles";
import { useSpeechRecognition } from "../utils/useSpeechRecognition";
import "swiper/css";
import "swiper/css/navigation";

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
}) {
  const swiperRef = useRef(null);
  const hasConclusion = Boolean(nextStoredChapterNumber || lesson || (choices && choices.length > 0));

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
        targetId = focusIndex < numChoices ? `choice-btn-${focusIndex}` : "return-home-btn";
      }
      const el = document.getElementById(targetId);
      if (el && typeof el.focus === "function") {
        el.focus();
      }
    }
  }, [pageIndex, pages.length, focusIndex, choices, nextStoredChapterNumber]);

  const handleSlideChange = (swiper) => {
    onTurn(swiper.activeIndex);
  };

  return (
    <div data-testid="story-screen" className="relative z-10 flex h-screen w-full items-center justify-center">
      {/* Bedtime Dimmer Veil (Wind-Down Routine) */}
      {windDown && (
        <div
          data-testid="bedtime-dimmer-veil"
          className="pointer-events-none fixed inset-0 z-0 bg-night/30 backdrop-blur-[0.5px] transition-opacity duration-1000"
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

      {/* Narration audio status / manual toggle */}
      {onToggleNarration && (
        <button
          onClick={onToggleNarration}
          aria-label={isNarrating ? "Pause narration" : "Play narration"}
          title={isNarrating ? "Click to pause narration" : "Click to play narration"}
          className="absolute top-3 right-3 sm:top-6 sm:right-8 z-30 flex items-center gap-1.5 sm:gap-2 rounded-full border border-starlight/20 bg-panel/70 px-2.5 sm:px-4 py-1 sm:py-2 font-sans text-xs sm:text-sm text-starlight hover:bg-panel/90 hover:text-parchment backdrop-blur-sm transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-lamp/50 cursor-pointer"
        >
          {isNarrating ? (
            <>
              <Volume2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-lamp animate-pulse" />
              <span className="hidden sm:inline">Reading aloud</span>
            </>
          ) : (
            <>
              <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-starlight/60" />
              <span>Listen</span>
            </>
          )}
        </button>
      )}

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

          return (
            <SwiperSlide key={idx} className="flex items-center justify-center p-2.5 pt-12 pb-3 sm:p-6 sm:pt-16 sm:pb-10 md:px-14 md:py-12">
              <div className="flex flex-col landscape:flex-row md:grid md:grid-cols-2 h-full max-h-[92vh] md:max-h-[38rem] w-full max-w-6xl min-h-0 overflow-hidden rounded-xl md:rounded-sm bg-panel/60 shadow-2xl shadow-black/40 backdrop-blur-sm">
                {/* Illustration column with Ken Burns cinematic camera movement and ambient particles */}
                <div className="relative h-56 sm:h-72 landscape:h-full landscape:w-1/2 md:w-full md:h-full w-full max-h-[42vh] sm:max-h-[48vh] md:max-h-none min-h-0 overflow-hidden bg-night/95 shrink-0 md:shrink flex items-center justify-center p-2.5 sm:p-4 md:p-0">
                  {illustrationUrl ? (
                    <>
                      {/* Ambient blurred backdrop for seamless edge blending on mobile */}
                      <div
                        className="absolute inset-0 block md:hidden bg-cover bg-center blur-2xl opacity-30 scale-110 pointer-events-none"
                        style={{ backgroundImage: `url(${illustrationUrl})` }}
                      />
                      <img
                        src={illustrationUrl}
                        alt={`Illustration for page ${idx + 1}`}
                        className={`relative z-10 max-h-full max-w-full w-auto h-auto object-contain md:absolute md:inset-0 md:h-full md:w-full md:object-cover ${kenBurnsClass} transition-opacity duration-700 select-none shadow-md md:shadow-none rounded-lg md:rounded-none`}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
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
                  )}
                  {/* Soft inner edge so the image reads as part of the page, not a pasted photo */}
                  <div className="pointer-events-none absolute inset-0 z-20 shadow-[inset_0_0_40px_rgba(0,0,0,0.35)]" />
                </div>

                {/* Text column — centered vertically and horizontally */}
                <div className="flex flex-1 h-full w-full landscape:w-1/2 md:w-full min-h-0 items-center justify-center px-4 py-3 sm:px-8 sm:py-6 md:px-12 md:py-8 lg:px-16 text-center overflow-y-auto">
                  <p
                    key={turnKey}
                    data-testid="page-text"
                    className={`animate-page-in font-serif text-lg sm:text-xl md:text-2xl lg:text-3xl leading-relaxed text-center w-full transition-colors duration-1000 ${windDown ? "text-parchment/85" : "text-parchment"
                      }`}
                  >
                    {activeSpeechMark &&
                      idx === pageIndex &&
                      typeof activeSpeechMark.start === "number" &&
                      typeof activeSpeechMark.end === "number" &&
                      activeSpeechMark.end <= pageText.length ? (
                      <>
                        <span>{pageText.slice(0, activeSpeechMark.start)}</span>
                        <span
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
                  </p>
                </div>
              </div>
            </SwiperSlide>
          );
        })}

        {/* Conclusion, Bedtime Lesson & Interactive Next Chapter Choices Slide */}
        {hasConclusion && (
          <SwiperSlide key="conclusion" className="flex items-center justify-center p-3 pt-14 pb-6 sm:p-6 md:px-10 md:py-10 min-h-0">
            <div
              data-testid="story-conclusion"
              className="flex flex-col items-center justify-between w-full max-w-4xl h-full max-h-[88vh] md:max-h-[38rem] min-h-0 p-4 sm:p-6 md:p-8 rounded-xl bg-panel/75 border border-starlight/20 shadow-2xl shadow-black/50 backdrop-blur-md text-center overflow-y-auto"
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
                  className="my-2 sm:my-3 w-full max-w-2xl rounded-xl bg-dusk/60 border border-lamp/30 p-3 sm:p-4 md:p-5 shadow-inner text-center"
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
                <div className="w-full max-w-xl my-2 sm:my-4">
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
                  <div className="w-full max-w-3xl my-2">
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 text-starlight/80 font-sans text-xs md:text-sm uppercase tracking-wider font-semibold">
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
                        <button
                          type="button"
                          data-testid="voice-twist-btn"
                          onClick={twistSpeech.toggleListening}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full font-sans text-xs font-semibold tracking-wide transition-all cursor-pointer ${twistSpeech.isListening
                              ? "bg-lamp text-night animate-pulse shadow-lg shadow-lamp/50 scale-105"
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
                              data-testid="weave-twist-btn"
                              onClick={() => onSelectChoice && onSelectChoice(customTwist)}
                              className="px-2.5 py-1 rounded bg-lamp text-night font-sans font-bold text-xs hover:bg-lamp/90 cursor-pointer shadow"
                            >
                              Weave Twist &rarr;
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              )}

              {/* Return to Home option */}
              <div className="mt-3 pt-2 border-t border-starlight/10 w-full flex justify-center">
                {(() => {
                  const targetHomeIndex = nextStoredChapterNumber ? 1 : (choices ? choices.length : 0);
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

      {/* Page indicator */}
      <div className="pointer-events-none absolute bottom-10 sm:bottom-8 left-1/2 z-20 -translate-x-1/2 font-sans text-xs sm:text-sm text-starlight/70">
        {pageIndex >= pages.length
          ? `Chapter ${chapter} • The End`
          : `Page ${pageIndex + 1} of ${pages.length}`}
      </div>
    </div>
  );
}