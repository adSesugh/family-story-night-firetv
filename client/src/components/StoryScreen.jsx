import { useEffect, useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Keyboard, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";

export default function StoryScreen({ pages, illustrations = [], pageIndex, turnKey, onTurn }) {
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
          const illustrationUrl = illustrations[idx] ?? null;
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

                {/* Text column — generous, consistent padding, vertically centered */}
                <div className="flex h-full items-center px-14 py-12">
                  <p
                    key={turnKey}
                    className="animate-page-in font-serif text-[1.75rem] leading-[1.6] text-parchment"
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