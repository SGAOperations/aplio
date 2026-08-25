'use client';

const CHART_TOKENS = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
] as const;

const SHARED_OPTIONS = {
  particleCount: 60,
  spread: 60,
  startVelocity: 45,
  ticks: 180,
  scalar: 0.9,
};

let isFiring = false;

// Sentinel round-trip: an unparsable oklch() token leaves fillStyle
// unchanged, so it's distinguishable from a real parsed color.
function resolveChartPalette(): string[] | undefined {
  const root = getComputedStyle(document.documentElement);
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return undefined;

  const sentinel = '#010203';
  const colors = CHART_TOKENS.map((token) => {
    const value = root.getPropertyValue(token).trim();
    ctx.fillStyle = sentinel;
    ctx.fillStyle = value;
    return ctx.fillStyle;
  }).filter(
    (color): color is string => typeof color === 'string' && color !== sentinel,
  );

  return colors.length >= 2 ? colors : undefined;
}

export async function fireConfetti(): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (isFiring) return;

    let canvas: HTMLCanvasElement | undefined;
    try {
      isFiring = true;
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.className =
        'fixed inset-0 h-full w-full pointer-events-none z-[100]';
      document.body.appendChild(canvas);

      const confetti = (await import('canvas-confetti')).default;
      const cannon = confetti.create(canvas, {
        resize: true,
        useWorker: false,
      });
      const colors = resolveChartPalette();

      await Promise.all([
        cannon({
          ...SHARED_OPTIONS,
          angle: 60,
          origin: { x: 0, y: 0.75 },
          colors,
        }),
        cannon({
          ...SHARED_OPTIONS,
          angle: 120,
          origin: { x: 1, y: 0.75 },
          colors,
        }),
      ]);
    } finally {
      canvas?.remove();
      isFiring = false;
    }
  } catch {
    // Decorative effect; a chunk-load or canvas failure should degrade
    // silently rather than surface to a caller expecting no rejection.
  }
}
