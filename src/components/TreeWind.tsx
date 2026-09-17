"use client";

const LEAVES = [
  { x: 6, delay: 0, duration: 22, size: 18, drift: 18, tint: 0 },
  { x: 14, delay: 3.2, duration: 26, size: 14, drift: 12, tint: 1 },
  { x: 22, delay: 7.1, duration: 19, size: 20, drift: 24, tint: 2 },
  { x: 31, delay: 1.4, duration: 24, size: 16, drift: 16, tint: 0 },
  { x: 39, delay: 9.6, duration: 28, size: 19, drift: 10, tint: 1 },
  { x: 48, delay: 4.8, duration: 21, size: 13, drift: 22, tint: 2 },
  { x: 57, delay: 12.2, duration: 25, size: 17, drift: 14, tint: 0 },
  { x: 66, delay: 2.7, duration: 23, size: 21, drift: 20, tint: 1 },
  { x: 74, delay: 8.4, duration: 27, size: 15, drift: 11, tint: 2 },
  { x: 83, delay: 5.5, duration: 20, size: 18, drift: 19, tint: 0 },
  { x: 91, delay: 11, duration: 29, size: 16, drift: 13, tint: 1 },
  { x: 97, delay: 6.3, duration: 22, size: 19, drift: 17, tint: 2 },
];

/** Decorative wind + falling leaves over the family graph. */
export function TreeWind() {
  return (
    <div className="tree-wind" aria-hidden>
      <div className="tree-wind__haze" />
      {LEAVES.map((leaf, i) => (
        <span
          key={i}
          className={`tree-wind__leaf tree-wind__leaf--${leaf.tint}`}
          style={{
            left: `${leaf.x}%`,
            animationDelay: `-${leaf.delay + 4}s`,
            animationDuration: `${leaf.duration}s`,
            width: leaf.size,
            height: leaf.size * 1.45,
            ["--leaf-drift" as string]: `${leaf.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
