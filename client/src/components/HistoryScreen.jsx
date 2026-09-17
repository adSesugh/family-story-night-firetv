import { useState, useEffect } from "react";
import { BookOpen, ArrowLeft, Trash2 } from "lucide-react";
import { loadHistory, deleteStory, clearHistory } from "../utils/storyHistory";

export default function HistoryScreen({ onSelect, onBack }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleDelete = (id) => {
    if (window.confirm("Delete this story?")) {
      deleteStory(id);
      setHistory(loadHistory());
    }
  };

  const handleClearAll = () => {
    if (window.confirm("Delete all stories? This cannot be undone.")) {
      clearHistory();
      setHistory([]);
    }
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="relative z-10 flex h-full w-full max-w-4xl flex-col px-12">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-10 w-10 text-[#E8A33D]" />
          <h1 className="font-serif text-5xl leading-tight text-parchment">
            Story History
          </h1>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-sm bg-starlight/20 px-6 py-2 font-sans text-base text-parchment transition-colors hover:bg-starlight/30"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
      </div>

      {history.length === 0 ? (
        <p className="font-sans text-base text-starlight/60">No stories yet.</p>
      ) : (
        <>
          <button
            onClick={handleClearAll}
            className="mb-6 inline-flex items-center gap-2 rounded-sm bg-red-900/40 px-4 py-2 font-sans text-sm text-red-200 transition-colors hover:bg-red-900/60"
          >
            <Trash2 className="h-4 w-4" />
            <span>Clear All History</span>
          </button>

          <div className="flex-1 space-y-2 overflow-y-auto">
            {history.map((story) => (
              <div
                key={story.id}
                className="flex cursor-pointer items-start justify-between gap-4 rounded-sm bg-starlight/10 px-6 py-4 transition-colors hover:bg-starlight/20"
                onClick={() => onSelect(story)}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm text-starlight">
                    {formatDate(story.generatedAt)}
                  </p>
                  <p className="mt-1 font-sans text-base text-parchment">
                    {story.familyMembers.join(", ")}
                  </p>
                  <p className="mt-1 font-sans text-sm text-starlight/70">
                    Theme: {story.theme}
                  </p>
                  <p className="mt-2 line-clamp-2 font-serif text-base text-parchment/80">
                    {story.firstPage}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(story.id);
                  }}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-sm bg-red-900/30 px-3 py-2 font-sans text-sm text-red-300 transition-colors hover:bg-red-900/50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
