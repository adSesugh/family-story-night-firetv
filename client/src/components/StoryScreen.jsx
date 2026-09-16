import { useEffect, useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Keyboard, Navigation } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";

export default function StoryScreen({ pages, pageIndex, turnKey, onTurn }) {
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
    <div className="relative z-10 w-full max-w-3xl">
      <Swiper
        ref={swiperRef}
        modules={[Keyboard, Navigation]}
        keyboard={{ enabled: true }}
        navigation={{
          nextEl: ".swiper-button-next",
          prevEl: ".swiper-button-prev",
        }}
        onSlideChange={handleSlideChange}
        initialSlide={pageIndex}
        className="w-full"
      >
        {pages.map((page, idx) => (
          <SwiperSlide key={idx} className="flex items-center justify-center px-12 py-20">
            <div className="w-full rounded-sm bg-panel/60 px-16 py-14 shadow-2xl shadow-black/40 backdrop-blur-sm">
              <p
                key={turnKey}
                className="animate-page-in font-serif text-4xl leading-relaxed text-parchment"
              >
                {page}
              </p>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Custom Navigation Buttons */}
      <div className="mt-8 flex w-full max-w-3xl items-center justify-between font-sans text-base text-starlight">
        <button
          className="swiper-button-prev transition-opacity hover:text-parchment disabled:opacity-0"
          disabled={pageIndex === 0}
        >
          ← Previous
        </button>
        <span className="text-starlight/70">
          Page {pageIndex + 1} of {pages.length}
        </span>
        <button
          className="swiper-button-next transition-opacity hover:text-parchment disabled:opacity-0"
          disabled={pageIndex === pages.length - 1}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
