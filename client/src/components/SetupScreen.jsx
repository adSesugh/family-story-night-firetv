export default function SetupScreen({ names, setNames, themeIndex, setThemeIndex, error, onSubmit, themes }) {
  return (
    <div className="relative z-10 w-full max-w-2xl px-12">
      <p className="font-sans text-lg text-starlight">Family Story Night</p>
      <h1 className="mt-2 font-serif text-6xl leading-tight text-parchment">
        Who&rsquo;s in tonight&rsquo;s story?
      </h1>

      <input
        className="mt-10 w-full rounded-sm border-b-2 border-starlight/40 bg-transparent px-1 py-3 font-serif text-3xl text-parchment placeholder:text-starlight/50 focus:border-[#e8a33d] focus:outline-none"
        value={names}
        onChange={(e) => setNames(e.target.value)}
        placeholder="Maya, Dad, Biscuit the dog"
        autoFocus
      />

      <div className="mt-8 flex items-center gap-4 font-sans text-base">
        <span className="text-starlight">Tonight&rsquo;s theme</span>
        <span className="text-parchment">{themes[themeIndex]}</span>
        <div className="flex gap-1">
          {themes.map((_, i) => (
            <button
              key={i}
              onClick={() => setThemeIndex(i)}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === themeIndex ? "bg-lamp" : "bg-starlight/30"
              }`}
              aria-label={`Theme ${i + 1}`}
            />
          ))}
        </div>
        <span className="text-starlight/60">↑ / ↓ to change</span>
      </div>

      {error && <p className="mt-6 font-sans text-base text-red-300">{error}</p>}

      <button
        onClick={onSubmit}
        className="mt-10 rounded-sm bg-lamp px-8 py-3 font-sans text-lg font-medium text-dusk transition-transform hover:scale-[1.02] focus:outline-none"
      >
        Begin the story
      </button>
      <p className="mt-3 font-sans text-sm text-starlight/60">or press Enter</p>
    </div>
  );
}
