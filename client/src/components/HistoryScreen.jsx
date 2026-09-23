import React, { useState, useEffect, useRef, useMemo } from "react";
import { BookOpen, ArrowLeft, Trash2, Sparkles, Play, Calendar } from "lucide-react";
import {
  loadHistory,
  deleteStory,
  clearHistory,
  isBiblicalStory,
  fetchStoriesFromServer,
  deleteStoryFromServer,
} from "../utils/storyHistory";
import { getDeviceId } from "../utils/device";
import ConfirmModal from "./ConfirmModal";
import Toast from "./Toast";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const PAGE_BATCH_SIZE = 8;

export default function HistoryScreen({ onSelect, onBack }) {
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState("all"); // "all" | "adventures" | "bible"
  const [visibleCount, setVisibleCount] = useState(PAGE_BATCH_SIZE);
  const [confirmModal, setConfirmModal] = useState(null); // { isOpen: boolean, type: "single" | "all", id?: string, title?: string, message?: string, confirmText?: string }
  const [toastMessage, setToastMessage] = useState(null);
  const scrollContainerRef = useRef(null);
  const sentinelRef = useRef(null);

  useEffect(() => {
    setHistory(loadHistory());
    fetchStoriesFromServer(API_BASE, getDeviceId()).then((serverStories) => {
      if (Array.isArray(serverStories) && serverStories.length > 0) {
        setHistory(serverStories);
      }
    });
  }, []);

  const requestDeleteStory = (id, storyTitle) => {
    setConfirmModal({
      isOpen: true,
      type: "single",
      id,
      title: "Delete Bedtime Story?",
      message: storyTitle
        ? `Are you sure you want to remove "${storyTitle}"? This bedtime memory will be removed from your bookshelf.`
        : "Are you sure you want to remove this story from your bookshelf?",
      confirmText: "Delete Story",
    });
  };

  const requestClearAll = () => {
    setConfirmModal({
      isOpen: true,
      type: "all",
      title: "Clear Entire Bookshelf?",
      message: "Are you sure you want to delete all saved stories? This will permanently remove all your saved bedtime adventures.",
      confirmText: "Clear All",
    });
  };

  const handleConfirmAction = () => {
    if (!confirmModal) return;

    if (confirmModal.type === "single" && confirmModal.id) {
      deleteStory(confirmModal.id);
      deleteStoryFromServer(API_BASE, getDeviceId(), confirmModal.id);
      setHistory(loadHistory());
      setToastMessage("Bedtime story removed from your bookshelf");
    } else if (confirmModal.type === "all") {
      clearHistory();
      setHistory([]);
      setToastMessage("All saved bedtime stories cleared");
    }
    setConfirmModal(null);
  };

  const formatDate = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Filter stories
  const filteredStories = useMemo(() => {
    return history.filter((story) => {
      if (filter === "bible") return isBiblicalStory(story);
      if (filter === "adventures") return !isBiblicalStory(story);
      return true;
    });
  }, [history, filter]);

  // Infinite scroll: slice visible batch
  const visibleStories = useMemo(() => {
    return filteredStories.slice(0, visibleCount);
  }, [filteredStories, visibleCount]);

  const hasMore = visibleCount < filteredStories.length;

  // IntersectionObserver for infinite scrolling
  useEffect(() => {
    if (!hasMore || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_BATCH_SIZE, filteredStories.length));
        }
      },
      {
        root: scrollContainerRef.current,
        threshold: 0.1,
      }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [hasMore, filteredStories.length]);

  // Scroll event fallback for infinite scroll
  const handleScroll = (e) => {
    if (!hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 150) {
      setVisibleCount((prev) => Math.min(prev + PAGE_BATCH_SIZE, filteredStories.length));
    }
  };

  const adventureCount = useMemo(
    () => history.filter((s) => !isBiblicalStory(s)).length,
    [history]
  );
  const bibleCount = useMemo(
    () => history.filter((s) => isBiblicalStory(s)).length,
    [history]
  );

  return (
    <div className="relative z-4 flex h-full w-full flex-col px-4 sm:px-8 md:px-12 py-4 sm:py-6 overflow-hidden text-parchment">
      {/* Top Bar */}
      <div className="mb-4 sm:mb-6 flex flex-wrap items-center justify-between gap-3 sm:gap-4 border-b border-starlight/15 pb-4 sm:pb-5">
        {/* Title & Total Badge */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-lamp/20 border border-lamp/40 text-lamp shadow-md shadow-lamp/10">
            <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold leading-none text-parchment">
                Story History
              </h1>
              <span className="rounded-full bg-starlight/20 px-2 sm:px-2.5 py-0.5 font-sans text-[10px] sm:text-xs font-semibold text-starlight">
                {history.length} {history.length === 1 ? "story" : "stories"}
              </span>
            </div>
            <p className="font-sans text-xs text-starlight/70 mt-1">
              Replay treasured bedtime journeys and faith-filled stories
            </p>
          </div>
        </div>

        {/* Collection Filter Tabs */}
        {history.length > 0 && (
          <div
            className="flex items-center gap-1.5 rounded-full bg-panel/80 p-1 border border-starlight/20 backdrop-blur-md"
            role="tablist"
            aria-label="Story Categories"
          >
            <button
              type="button"
              role="tab"
              aria-selected={filter === "all"}
              onClick={() => {
                setFilter("all");
                setVisibleCount(PAGE_BATCH_SIZE);
              }}
              className={`rounded-full px-3.5 py-1 text-xs font-sans font-semibold transition-all ${filter === "all"
                ? "bg-lamp text-dusk shadow-md font-bold"
                : "text-starlight hover:text-parchment hover:bg-starlight/10"
                }`}
            >
              All ({history.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "adventures"}
              onClick={() => {
                setFilter("adventures");
                setVisibleCount(PAGE_BATCH_SIZE);
              }}
              className={`flex items-center gap-1 rounded-full px-3.5 py-1 text-xs font-sans font-semibold transition-all ${filter === "adventures"
                ? "bg-lamp text-dusk shadow-md font-bold"
                : "text-starlight hover:text-parchment hover:bg-starlight/10"
                }`}
            >
              <Sparkles className="h-3 w-3" />
              Adventures ({adventureCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "bible"}
              onClick={() => {
                setFilter("bible");
                setVisibleCount(PAGE_BATCH_SIZE);
              }}
              className={`flex items-center gap-1 rounded-full px-3.5 py-1 text-xs font-sans font-semibold transition-all ${filter === "bible"
                ? "bg-lamp text-dusk shadow-md font-bold"
                : "text-starlight hover:text-parchment hover:bg-starlight/10"
                }`}
            >
              <BookOpen className="h-3 w-3" />
              Bible Stories ({bibleCount})
            </button>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {history.length > 0 && (
            <button
              type="button"
              onClick={requestClearAll}
              className="flex items-center gap-1.5 rounded-lg border border-red-800/40 bg-red-950/30 px-3.5 py-2 font-sans text-xs font-semibold text-red-300 transition-colors hover:bg-red-900/50 hover:border-red-600"
              aria-label="Clear All History"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Clear All</span>
            </button>
          )}
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg bg-starlight/20 px-5 py-2 font-sans text-sm font-semibold text-parchment transition-all hover:bg-starlight/30 hover:scale-[1.02] border border-starlight/20"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {history.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-lamp/15 border border-lamp/30 text-lamp shadow-xl shadow-lamp/10">
            <BookOpen className="h-10 w-10" />
          </div>
          <h2 className="font-serif text-2xl md:text-3xl text-parchment font-bold">
            No stories written yet
          </h2>
          <p className="mt-2 max-w-md font-sans text-sm text-starlight/70">
            Once you weave your first bedtime adventure or Bible story, it will be saved right here
            in your family bookshelf to replay anytime.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-6 flex items-center gap-2 rounded-xl bg-lamp px-6 py-3 font-sans text-sm font-bold text-dusk shadow-lg shadow-lamp/25 transition-all hover:scale-105"
          >
            <Sparkles className="h-4 w-4" />
            <span>Start Tonight&rsquo;s First Story</span>
          </button>
        </div>
      ) : filteredStories.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <p className="font-serif text-xl text-parchment">No stories match this filter.</p>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="mt-4 rounded-lg bg-starlight/20 px-4 py-2 font-sans text-xs text-starlight hover:text-parchment"
          >
            View all stories
          </button>
        </div>
      ) : (
        /* Full-Screen Scrollable Grid Container */
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-2 sm:px-4 pb-8 pt-4"
          tabIndex={-1}
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleStories.map((story) => {
              const coverUrl =
                story.illustrations?.[0] ||
                (Array.isArray(story.pages) && story.pages[0]?.illustration?.url) ||
                null;
              const isBible = isBiblicalStory(story);
              const familyText =
                Array.isArray(story.familyMembers) && story.familyMembers.length > 0
                  ? story.familyMembers.join(", ")
                  : isBible
                    ? "Classic Bible Story"
                    : "Classic Story";
              const pageCount = Array.isArray(story.pages) ? story.pages.length : null;
              const excerpt =
                typeof story.firstPage === "string"
                  ? story.firstPage
                  : story.pages?.[0]?.text || story.pages?.[0] || "";

              return (
                <div
                  key={story.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(story)}
                  onKeyDown={(e) => {
                    if (e.target.closest("button")) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(story);
                    }
                  }}
                  className="group relative flex flex-col rounded-2xl border border-starlight/15 bg-panel/85 hover:bg-panel hover:border-lamp/60 transition-all duration-300 shadow-md hover:shadow-2xl hover:shadow-lamp/15 hover:-translate-y-1.5 cursor-pointer overflow-hidden focus:outline-none focus:ring-2 focus:ring-lamp focus:border-lamp"
                  data-testid={`history-card-${story.id}`}
                >
                  {/* Cover Thumbnail */}
                  <div className="relative h-44 w-full overflow-hidden bg-dusk/90 border-b border-starlight/10">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={story.theme}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#1b153b] via-[#24173d] to-[#2d1b2e] p-4 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-lamp/20 text-lamp border border-lamp/30 shadow-inner mb-2">
                          {isBible ? (
                            <BookOpen className="h-6 w-6" />
                          ) : (
                            <Sparkles className="h-6 w-6" />
                          )}
                        </div>
                        <span className="font-serif text-sm font-medium text-parchment/90 line-clamp-1">
                          {story.theme}
                        </span>
                      </div>
                    )}

                    {/* Gradient Overlay for Text Legibility */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

                    {/* Top Left: Category Badge */}
                    <div className="absolute top-2.5 left-2.5 z-10">
                      {isBible ? (
                        <span className="flex items-center gap-1 rounded-full bg-blue-950/90 px-2.5 py-1 text-[11px] font-sans font-semibold text-blue-200 backdrop-blur-md border border-blue-400/40 shadow-sm">
                          <BookOpen className="h-3 w-3 text-blue-300" /> Bible Story
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-amber-950/90 px-2.5 py-1 text-[11px] font-sans font-semibold text-lamp backdrop-blur-md border border-lamp/40 shadow-sm">
                          <Sparkles className="h-3 w-3 text-lamp" /> Adventure
                        </span>
                      )}
                    </div>

                    {/* Top Right: Delete Button */}
                    <div className="absolute top-2.5 right-2.5 z-10">
                      <button
                        type="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDeleteStory(story.id, story.theme);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-dusk/80 text-starlight/70 backdrop-blur-md transition-all hover:bg-red-900/80 hover:text-red-200 border border-starlight/20 hover:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-red-900/80"
                        title="Delete story"
                        aria-label="Delete story"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Bottom Info: Page Count & Chapter */}
                    <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] font-sans font-medium text-starlight drop-shadow">
                      <span>{formatDate(story.updatedAt || story.generatedAt)}</span>
                      {pageCount && (
                        <span className="rounded bg-black/50 px-1.5 py-0.5 text-parchment/90 backdrop-blur-xs font-semibold">
                          {pageCount}p {story.chapters?.length > 1 ? `• Ch. 1–${story.chapters.length}` : (story.chapter > 1 ? `• Ch. ${story.chapter}` : "")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="flex flex-1 flex-col p-4">
                    {/* Theme / Title */}
                    <h3 className="font-serif text-lg font-bold text-parchment group-hover:text-lamp transition-colors line-clamp-1">
                      {story.theme}
                    </h3>

                    {/* Characters / Listeners */}
                    <p className="mt-1 font-sans text-xs text-starlight/80 line-clamp-1">
                      <span className="text-starlight/50">With: </span>
                      {familyText}
                    </p>

                    {/* Opening excerpt */}
                    <p className="mt-2 line-clamp-2 font-serif text-xs md:text-sm text-parchment/75 leading-relaxed flex-1">
                      {excerpt}
                    </p>

                    {/* Bedtime Moral Preview (if saved) */}
                    {story.lesson && (
                      <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-lamp/10 border border-lamp/25 px-2.5 py-1.5">
                        <Sparkles className="h-3 w-3 text-lamp flex-shrink-0 mt-0.5" />
                        <p className="font-sans text-[11px] italic text-lamp line-clamp-1">
                          {story.lesson}
                        </p>
                      </div>
                    )}

                    {/* Action Footer */}
                    <div className="mt-4 flex items-center justify-between border-t border-starlight/10 pt-2.5 font-sans text-xs text-starlight/70 group-hover:text-lamp transition-colors">
                      <span className="font-medium flex items-center gap-1.5">
                        {story.chapters?.length > 1 ? (
                          <>
                            <span>Read from Ch. 1 ({story.chapters.length} Chapters)</span>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Multi-chapter storybook" />
                          </>
                        ) : story.chapter > 1 ? (
                          <>
                            <span>Continue Ch. {story.chapter}</span>
                            {story.choices && story.choices.length > 0 && (
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" title="Ready to branch into next chapter" />
                            )}
                          </>
                        ) : (
                          "Read tonight"
                        )}
                      </span>
                      <div className="flex items-center gap-1 font-semibold group-hover:translate-x-1 transition-transform">
                        <Play className="h-3.5 w-3.5 fill-current" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Infinite Scroll Sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className="mt-8 flex justify-center py-4" data-testid="scroll-sentinel">
              <span className="flex items-center gap-2 font-sans text-xs text-starlight/60">
                <span className="h-1.5 w-1.5 rounded-full bg-lamp animate-pulse" />
                Loading more bedtime memories...
              </span>
            </div>
          )}

          {/* End of Stories Footer */}
          {!hasMore && filteredStories.length > 0 && (
            <div className="mt-10 mb-4 text-center font-sans text-xs text-starlight/50">
              <span>You&rsquo;ve reached the beginning of your bedtime memories 🌙</span>
            </div>
          )}
        </div>
      )}

      {/* Bedtime Story Confirmation Dialog */}
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          cancelText="Keep Story"
          confirmVariant="danger"
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {/* Bedtime Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type="success"
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
