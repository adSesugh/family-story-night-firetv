import { useEffect, useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import { Volume2, VolumeX, Sparkles, Compass, Home } from "lucide-react";
import AmbientParticles from "./AmbientParticles";
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
  onSelectChoice,
  onReturnHome,
  focusIndex = 0,
  onFocusIndexChange,
}) {
  const swiperRef = useRef(null);
  const hasConclusion = Boolean(lesson || (choices && choices.length > 0));

  // Sync Swiper with pageIndex when it changes from parent
  useEffect(() => {
    if (swiperRef.current && swiperRef.current.swiper) {
      swiperRef.current.swiper.slideTo(pageIndex, 0);
    }
  }, [pageIndex]);

  // Keep DOM focus synchronized with focusIndex on the conclusion slide for Fire TV remote
  useEffect(() => {
    if (pageIndex >= pages.length) {
      const numChoices = choices ? choices.length : 0;
      const targetId = focusIndex < numChoices ? `choice-btn-${focusIndex}` : "return-home-btn";
      const el = document.getElementById(targetId);
      if (el && typeof el.focus === "function") {
        el.focus();
      }
    }
  }, [pageIndex, pages.length, focusIndex, choices]);

  const handleSlideChange = (swiper) => {
    onTurn(swiper.activeIndex);
  };

  return (
    <div data-testid="story-screen" className="relative z-10 flex h-screen w-full items-center justify-center">
      {/* Narration audio status / manual toggle */}
      {onToggleNarration && (
        <button
          onClick={onToggleNarration}
          aria-label={isNarrating ? "Pause narration" : "Play narration"}
          title={isNarrating ? "Click to pause narration" : "Click to play narration"}
          className="absolute top-6 right-8 z-30 flex items-center gap-2 rounded-full border border-starlight/20 bg-panel/70 px-4 py-2 font-sans text-sm text-starlight hover:bg-panel/90 hover:text-parchment backdrop-blur-sm transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-lamp/50 cursor-pointer"
        >
          {isNarrating ? (
            <>
              <Volume2 className="h-4 w-4 text-lamp animate-pulse" />
              <span>Reading aloud</span>
            </>
          ) : (
            <>
              <VolumeX className="h-4 w-4 text-starlight/60" />
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
            <SwiperSlide key={idx} className="flex items-center justify-center px-16 py-14">
              <div className="grid h-full max-h-[38rem] w-full max-w-6xl grid-cols-2 grid-rows-1 min-h-0 overflow-hidden rounded-sm bg-panel/60 shadow-2xl shadow-black/40 backdrop-blur-sm">
                {/* Illustration column with Ken Burns cinematic camera movement and ambient particles */}
                <div className="relative h-full w-full min-h-0 overflow-hidden bg-dusk/40">
                  {illustrationUrl ? (
                    <>
                      <img
                        src={illustrationUrl}
                        alt={`Illustration for page ${idx + 1}`}
                        className={`absolute inset-0 h-full w-full object-cover ${kenBurnsClass} transition-opacity duration-700`}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                      {/* Ambient floating stardust & firefly motes */}
                      <AmbientParticles count={14} />
                    </>
                  ) : (
                    <div className="relative flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-dusk/60 via-night/80 to-dusk/90 overflow-hidden">
                      <div className="absolute inset-0 bg-radial-at-c from-lamp/10 via-transparent to-transparent animate-pulse" />
                      <AmbientParticles count={10} />
                      <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-lamp/15 border border-lamp/30 shadow-lg shadow-lamp/10 text-lamp animate-bounce duration-1000">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                          </svg>
                        </div>
                        <span className="font-serif text-lg md:text-xl italic text-starlight/80 tracking-wide">
                          Bringing scene to life&hellip;
                        </span>
                        <span className="text-xs uppercase font-sans tracking-widest text-lamp/70 font-semibold">
                          Painting Page {idx + 1}
                        </span>
                      </div>
                    </div>
                  )}
                  {/* Soft inner edge so the image reads as part of the page, not a pasted photo */}
                  <div className="pointer-events-none absolute inset-0 z-20 shadow-[inset_0_0_40px_rgba(0,0,0,0.35)]" />
                </div>

                {/* Text column — centered vertically and horizontally */}
                <div className="flex h-full w-full min-h-0 items-center justify-center px-12 md:px-16 text-center">
                  <p
                    key={turnKey}
                    className="animate-page-in font-serif text-[1.75rem] md:text-3xl leading-[1.65] text-parchment text-center w-full"
                  >
                    {pageText}
                  </p>
                </div>
              </div>
            </SwiperSlide>
          );
        })}

        {/* Conclusion, Bedtime Lesson & Interactive Next Chapter Choices Slide */}
        {hasConclusion && (
          <SwiperSlide key="conclusion" className="flex items-center justify-center px-10 py-10">
            <div
              data-testid="story-conclusion"
              className="flex flex-col items-center justify-between w-full max-w-4xl h-full max-h-[38rem] p-6 md:p-8 rounded-xl bg-panel/75 border border-starlight/20 shadow-2xl shadow-black/50 backdrop-blur-md text-center overflow-y-auto"
            >
              {/* Header */}
              <div className="flex flex-col items-center gap-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-lamp/20 border border-lamp/40 text-lamp text-xs font-sans uppercase tracking-widest font-semibold">
                  <Sparkles className="w-3.5 h-3.5" />
                  Chapter {chapter} Complete
                </span>
                <h2 className="font-serif text-3xl md:text-4xl font-bold text-parchment mt-0.5">
                  The End
                </h2>
              </div>

              {/* Bedtime Lesson to Learn */}
              {lesson && (
                <div
                  data-testid="story-lesson"
                  className="my-3 w-full max-w-2xl rounded-xl bg-dusk/60 border border-lamp/30 p-4 md:p-5 shadow-inner text-center"
                >
                  <div className="flex items-center justify-center gap-1.5 mb-1.5 text-lamp font-sans text-xs md:text-sm tracking-wider uppercase font-semibold">
                    <Sparkles className="w-4 h-4 text-lamp animate-pulse" />
                    <span>Tonight&apos;s Lesson to Learn</span>
                  </div>
                  <p className="font-serif italic text-lg md:text-xl text-parchment leading-relaxed">
                    &ldquo;{lesson}&rdquo;
                  </p>
                </div>
              )}

              {/* Next Adventure Choices */}
              {choices && choices.length > 0 && (
                <div className="w-full max-w-3xl my-2">
                  <div className="flex items-center justify-center gap-2 mb-3 text-starlight/80 font-sans text-xs md:text-sm uppercase tracking-wider font-semibold">
                    <Compass className="w-4 h-4 text-lamp" />
                    <span>What should happen in the next adventure?</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {choices.map((choice, cIdx) => {
                      const isFocused = pageIndex >= pages.length && focusIndex === cIdx;
                      return (
                        <button
                          key={cIdx}
                          id={`choice-btn-${cIdx}`}
                          data-testid={`choice-btn-${cIdx}`}
                          onClick={() => onSelectChoice && onSelectChoice(choice)}
                          onMouseEnter={() => onFocusIndexChange && onFocusIndexChange(cIdx)}
                          className={`group relative flex flex-col items-start text-left p-4 md:p-5 rounded-xl transition-all duration-200 shadow-lg cursor-pointer ${isFocused
                              ? "border-2 border-lamp bg-panel ring-4 ring-lamp/80 shadow-lamp/30 -translate-y-1 scale-[1.01]"
                              : "border border-starlight/25 bg-panel/90 hover:border-lamp hover:bg-panel"
                            }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1.5">
                            <span className="font-sans text-xs font-bold uppercase tracking-wider text-lamp">
                              Choice {cIdx + 1}
                            </span>
                            <span className="font-sans text-xs text-starlight/60 group-hover:text-lamp transition-colors">
                              Continue &rarr;
                            </span>
                          </div>
                          <p className="font-serif text-base md:text-lg text-parchment group-hover:text-white leading-snug">
                            {choice}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Return to Home option */}
              <div className="mt-3 pt-2 border-t border-starlight/10 w-full flex justify-center">
                {(() => {
                  const isHomeFocused = pageIndex >= pages.length && focusIndex === (choices ? choices.length : 0);
                  return (
                    <button
                      id="return-home-btn"
                      data-testid="return-home-btn"
                      onClick={onReturnHome}
                      onMouseEnter={() => onFocusIndexChange && onFocusIndexChange(choices ? choices.length : 0)}
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
      <div className="pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 font-sans text-sm text-starlight/70">
        {pageIndex >= pages.length
          ? `Chapter ${chapter} • The End`
          : `Page ${pageIndex + 1} of ${pages.length}`}
      </div>
    </div>
  );
}