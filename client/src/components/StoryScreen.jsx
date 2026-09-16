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

  const handlePrev = () => {
    if (swiperRef.current && swiperRef.current.swiper) {
      swiperRef.current.swiper.slidePrev();
    }
  };

  const handleNext = () => {
    if (swiperRef.current && swiperRef.current.swiper) {
      swiperRef.current.swiper.slideNext();
    }
  };

  const isFirst = pageIndex === 0;
  const isLast = pageIndex === pages.length - 1;

  return (
    <div className="relative z-10 flex w-full max-w-3xl flex-col items-center">
      <Swiper
        ref={swiperRef}
        modules={[Keyboard, Navigation]}
        keyboard={{ enabled: true }}
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

      {/* Navigation Controls */}
      <div className="mt-8 flex w-full items-center justify-between px-12 font-sans text-base text-starlight">
        <button
          onClick={handlePrev}
          disabled={isFirst}
          className="transition-opacity disabled:opacity-0 hover:text-parchment focus:outline-none"
        >
          ← Previous
        </button>
        <span className="text-starlight/70">
          Page {pageIndex + 1} of {pages.length}
        </span>
        <button
          onClick={handleNext}
          disabled={isLast}
          className="transition-opacity disabled:opacity-0 hover:text-parchment focus:outline-none"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
