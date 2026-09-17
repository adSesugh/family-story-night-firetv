import { useEffect, useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Keyboard, Navigation } from "swiper/modules";
import { Volume2, VolumeX } from "lucide-react";
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
}) {
  const swiperRef = useRef(null);

  // Sync Swiper with pageIndex when it changes from parent
  useEffect(() => {
    if (swiperRef.current && swiperRef.current.swiper) {
      swiperRef.current.swiper.slideTo(pageIndex, 0);
    }
  }, [pageIndex]);

  const handleSlideChange = (swiper) => {
    onTurn(swiper.activeIndex);
  };

  return (
    <div className="relative z-10 flex h-screen w-full items-center justify-center">
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
        modules={[Keyboard, Navigation]}
        keyboard={{ enabled: true }}
        onSlideChange={handleSlideChange}
        initialSlide={pageIndex}
        className="h-full w-full"
      >
        {pages.map((page, idx) => {
          const pageText = typeof page === "object" ? page.text : page; // keep backward compat
          const illustrationUrl = illustrations[idx] || (typeof page === "object" && page.illustration ? page.illustration.url : null);
          return (
            <SwiperSlide key={idx} className="flex items-center justify-center px-16 py-14">
              <div className="grid h-full max-h-[38rem] w-full max-w-6xl grid-cols-2 overflow-hidden rounded-sm bg-panel/60 shadow-2xl shadow-black/40 backdrop-blur-sm">
                {/* Illustration column — fills the full height/width of its half */}
                <div className="relative h-full w-full bg-dusk/40">
                  {illustrationUrl ? (
                    <img
                      src={illustrationUrl}
                      alt={`Illustration for page ${idx + 1}`}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="font-serif text-lg italic text-starlight/40">
                        Illustration loading&hellip;
                      </span>
                    </div>
                  )}
                  {/* Soft inner edge so the image reads as part of the page, not a pasted photo */}
                  <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.35)]" />
                </div>

                {/* Text column — centered vertically and horizontally */}
                <div className="flex h-full w-full items-center justify-center px-12 md:px-16 text-center">
                  <p
                    key={turnKey}
                    className="animate-page-in font-serif text-[1.65rem] md:text-2xl leading-[1.65] text-parchment text-center w-full"
                  >
                    {pageText}
                  </p>
                </div>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>

      {/* Decorative ellipse below card */}
      <div
        className="pointer-events-none absolute top-[55%] h-[40vh] w-[80vw] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #7C93C9 0%, transparent 70%)" }}
      />

      {/* Page indicator */}
      <div className="pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 font-sans text-sm text-starlight/70">
        Page {pageIndex + 1} of {pages.length}
      </div>
    </div>
  );
}