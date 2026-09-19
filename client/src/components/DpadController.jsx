import React, { useState, useEffect } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CornerDownLeft } from "lucide-react";

/**
 * DpadController — On-screen tactile D-Pad controller and Fire TV remote key visualizer.
 * Provides both interactive on-screen navigation buttons (for mouse/touch/testing)
 * and real-time visual feedback when physical Fire TV remote D-pad keys are pressed.
 */
export default function DpadController({
  onNavigate,
  className = "",
  showLegend = true,
}) {
  const [activeKey, setActiveKey] = useState(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      let direction = null;
      if (e.key === "ArrowUp" || e.keyCode === 38) direction = "up";
      else if (e.key === "ArrowDown" || e.keyCode === 40) direction = "down";
      else if (e.key === "ArrowLeft" || e.keyCode === 37) direction = "left";
      else if (e.key === "ArrowRight" || e.keyCode === 39) direction = "right";
      else if (e.key === "Enter" || e.keyCode === 13) direction = "select";

      if (direction) {
        setActiveKey(direction);
        const timer = setTimeout(() => setActiveKey(null), 250);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handlePress = (direction) => {
    setActiveKey(direction);
    setTimeout(() => setActiveKey(null), 200);
    if (onNavigate) {
      onNavigate(direction);
    }
  };

  const getBtnClass = (dir) => {
    const isActive = activeKey === dir;
    return `flex items-center justify-center transition-all duration-150 rounded-sm cursor-pointer select-none ${
      isActive
        ? "bg-lamp text-night scale-95 shadow-md shadow-lamp/50 font-bold"
        : "bg-starlight/15 text-parchment hover:bg-starlight/30 hover:text-lamp border border-starlight/20"
    }`;
  };

  return (
    <div
      data-testid="dpad-controller"
      className={`flex flex-col items-center rounded-xl border border-starlight/20 bg-panel/75 p-3.5 sm:p-4 shadow-xl backdrop-blur-md ${className}`}
      aria-label="Fire TV D-Pad Remote Controller"
    >
      <div className="mb-2.5 flex items-center gap-1.5 text-xs font-medium tracking-wider text-starlight uppercase">
        <span className="h-2 w-2 rounded-full bg-lamp animate-pulse" />
        <span>Fire TV D-Pad</span>
      </div>

      {/* Cross D-Pad Layout */}
      <div className="relative grid grid-cols-3 grid-rows-3 gap-1.5 w-32 h-32 sm:w-36 sm:h-36 p-1">
        {/* Top Empty */}
        <div />

        {/* Up Button */}
        <button
          type="button"
          onClick={() => handlePress("up")}
          aria-label="D-pad Up"
          className={`${getBtnClass("up")} col-start-2 row-start-1 h-10 sm:h-11`}
          title="Move focus up (ArrowUp)"
        >
          <ArrowUp className="h-5 w-5" />
        </button>

        {/* Top-Right Empty */}
        <div />

        {/* Left Button */}
        <button
          type="button"
          onClick={() => handlePress("left")}
          aria-label="D-pad Left"
          className={`${getBtnClass("left")} col-start-1 row-start-2 h-10 sm:h-11`}
          title="Move focus left or switch tab (ArrowLeft)"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Center / Select OK Button */}
        <button
          type="button"
          onClick={() => handlePress("select")}
          aria-label="D-pad Select"
          className={`${getBtnClass(
            "select"
          )} col-start-2 row-start-2 h-10 sm:h-11 font-sans text-xs font-bold`}
          title="Select / Activate (Enter / OK)"
        >
          OK
        </button>

        {/* Right Button */}
        <button
          type="button"
          onClick={() => handlePress("right")}
          aria-label="D-pad Right"
          className={`${getBtnClass("right")} col-start-3 row-start-2 h-10 sm:h-11`}
          title="Move focus right or switch tab (ArrowRight)"
        >
          <ArrowRight className="h-5 w-5" />
        </button>

        {/* Bottom-Left Empty */}
        <div />

        {/* Down Button */}
        <button
          type="button"
          onClick={() => handlePress("down")}
          aria-label="D-pad Down"
          className={`${getBtnClass("down")} col-start-2 row-start-3 h-10 sm:h-11`}
          title="Move focus down (ArrowDown)"
        >
          <ArrowDown className="h-5 w-5" />
        </button>

        {/* Bottom-Right Empty */}
        <div />
      </div>

      {/* Shortcut hints legend */}
      {showLegend && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px] font-sans text-starlight/75 text-center">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-starlight/30 bg-dusk/70 px-1 py-0.5 text-[10px] text-lamp font-mono">
              ▲/▼
            </kbd>
            Navigate
          </span>
          <span className="text-starlight/40">•</span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-starlight/30 bg-dusk/70 px-1 py-0.5 text-[10px] text-lamp font-mono">
              ◀/▶
            </kbd>
            Tabs
          </span>
          <span className="text-starlight/40">•</span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-starlight/30 bg-dusk/70 px-1 py-0.5 text-[10px] text-lamp font-mono">
              OK
            </kbd>
            Select
          </span>
        </div>
      )}
    </div>
  );
}
