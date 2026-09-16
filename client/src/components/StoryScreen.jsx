export default function StoryScreen({ pages, pageIndex, turnKey, onTurn }) {
  const isLast = pageIndex === pages.length - 1;
  const isFirst = pageIndex === 0;

  return (
    <div className="relative z-10 flex w-full max-w-3xl flex-col items-center px-12">
      <div className="w-full rounded-sm bg-panel/60 px-16 py-14 shadow-2xl shadow-black/40 backdrop-blur-sm">
        <p key={turnKey} className="animate-page-in font-serif text-4xl leading-relaxed text-parchment">
          {pages[pageIndex]}
        </p>
      </div>

      <div className="mt-8 flex w-full items-center justify-between font-sans text-base text-starlight">
        <button
          onClick={() => !isFirst && onTurn(pageIndex - 1)}
          className={`transition-opacity ${isFirst ? "opacity-0" : "opacity-100 hover:text-parchment"}`}
        >
          ← Previous page
        </button>
        <span className="text-starlight/70">
          Page {pageIndex + 1} of {pages.length}
        </span>
        <button
          onClick={() => !isLast && onTurn(pageIndex + 1)}
          className={`transition-opacity ${isLast ? "opacity-0" : "opacity-100 hover:text-parchment"}`}
        >
          Next page →
        </button>
      </div>
    </div>
  );
}