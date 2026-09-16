import { useState, useEffect } from "react";
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
    <div className="relative z-10 w-full max-w-4xl px-12 flex flex-col h-full">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-6xl leading-tight text-parchment">
          📖 Story History
        </h1>
        <button
          onClick={onBack}
          className="rounded-sm bg-starlight/20 px-6 py-2 font-sans text-base text-parchment hover:bg-starlight/30 transition-colors"
        >
          ← Back
        </button>
      </div>

      {history.length === 0 ? (
        <p className="font-sans text-base text-starlight/60">No stories yet.</p>
      ) : (
        <>
          <button
            onClick={handleClearAll}
            className="mb-6 rounded-sm bg-red-900/40 px-4 py-2 font-sans text-sm text-red-200 hover:bg-red-900/60 transition-colors"
          >
            Clear All History
          </button>

          <div className="flex-1 overflow-y-auto space-y-2">
            {history.map((story) => (
              <div
                key={story.id}
                className="flex items-start justify-between gap-4 rounded-sm bg-starlight/10 px-6 py-4 hover:bg-starlight/20 transition-colors cursor-pointer"
                onClick={() => onSelect(story)}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm text-starlight">
                    {formatDate(story.generatedAt)}
                  </p>
                  <p className="font-sans text-base text-parchment mt-1">
                    {story.familyMembers.join(", ")}
                  </p>
                  <p className="font-sans text-sm text-starlight/70 mt-1">
                    Theme: {story.theme}
                  </p>
                  <p className="font-serif text-base text-parchment/80 mt-2 line-clamp-2">
                    {story.firstPage}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(story.id);
                  }}
                  className="flex-shrink-0 rounded-sm bg-red-900/30 px-3 py-2 font-sans text-sm text-red-300 hover:bg-red-900/50 transition-colors"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
