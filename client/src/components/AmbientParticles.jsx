import { useMemo } from "react";

/**
 * AmbientParticles renders subtle, soothing starlight & firefly particles
 * floating over illustrations to give them a magical, calming "living picture book" feel.
 */
export default function AmbientParticles({ count = 12 }) {
  const particles = useMemo(() => {
    // Deterministic random-like values for gentle floating motes
    const items = [];
    const colors = ["#E8A33D", "#FEE48B", "#F4EFE6", "#7C93C9", "#A5B4FC"];

    for (let i = 0; i < count; i++) {
      const size = 3 + ((i * 37) % 5); // 3px to 7px
      const left = 8 + ((i * 83) % 84); // 8% to 92%
      const top = 10 + ((i * 71) % 80); // 10% to 90%
      const duration = 6 + ((i * 41) % 7); // 6s to 12s
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
  }, [count]);

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
