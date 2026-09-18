import { useMemo } from "react";

/**
 * AmbientParticles renders subtle, soothing starlight & firefly particles
 * floating over illustrations to give them a magical, calming "living picture book" feel.
 */
export default function AmbientParticles({ count = 12, windDown = false }) {
  const particles = useMemo(() => {
    // Deterministic random-like values for gentle floating motes
    const items = [];
    // In wind-down mode, use warm amber & candlelight tones; otherwise starry celestial palette
    const colors = windDown
      ? ["#E8A33D", "#D97724", "#FEE48B", "#F59E0B", "#FDE68A"]
      : ["#E8A33D", "#FEE48B", "#F4EFE6", "#7C93C9", "#A5B4FC"];

    for (let i = 0; i < count; i++) {
      const size = 3 + ((i * 37) % 5); // 3px to 7px
      const left = 8 + ((i * 83) % 84); // 8% to 92%
      const top = 10 + ((i * 71) % 80); // 10% to 90%
      // Slow down particle speed significantly in windDown mode for a sleepy, hypnotic float
      const baseDuration = windDown ? 10 : 6;
      const duration = baseDuration + ((i * 41) % 8);
      const delay = -((i * 23) % 6); // staggered negative delays
      const color = colors[i % colors.length];
      const isFirefly = i % 3 === 0;

      items.push({
        id: i,
        size,
        left: `${left}%`,
        top: `${top}%`,
        duration: `${duration}s`,
        delay: `${delay}s`,
        color,
        isFirefly,
      });
    }
    return items;
  }, [count, windDown]);

  return (
    <div
      data-testid="ambient-particles"
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full animate-float-mote"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            left: p.left,
            top: p.top,
            backgroundColor: p.color,
            boxShadow: p.isFirefly
              ? `0 0 ${p.size * 2.5}px ${p.color}, 0 0 ${p.size * 5}px rgba(232, 163, 61, 0.4)`
              : `0 0 ${p.size * 1.8}px ${p.color}`,
            "--mote-duration": p.duration,
            animationDelay: p.delay,
            opacity: p.isFirefly ? 0.75 : 0.45,
          }}
        />
      ))}
    </div>
  );
}
