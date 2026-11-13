import { useEffect, useRef } from "react";

/**
 * Champagne water: soft, flowing wave lines drifting across the whole screen over a black base.
 * Movement is slow and light; scrolling nudges the water a little. Respects reduced motion.
 */
export default function WaveBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(1.5, window.devicePixelRatio || 1);
      W = window.innerWidth;
      H = window.innerHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // scrolling gives the water a gentle push
    let kick = 0;
    let push = 0;
    let lastY = window.scrollY;
    const onScroll = () => {
      kick = Math.min(1, kick + Math.abs(window.scrollY - lastY) / 900);
      lastY = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    let t = 0;
    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      kick *= 0.94;
      push += (kick - push) * 0.08;
      t += dt * (1 + push * 1.6);

      ctx.clearRect(0, 0, W, H);

      const small = W < 700;
      const lines = small ? 16 : 26;
      const step = small ? 14 : 10;
      const gap = H / (lines - 1);

      // champagne gradient across the width: bright in the middle, fading to the edges
      const gx = ctx.createLinearGradient(0, 0, W, 0);
      gx.addColorStop(0, "rgba(245,185,66,0.35)");
      gx.addColorStop(0.5, "rgba(254,240,170,0.9)");
      gx.addColorStop(1, "rgba(245,185,66,0.35)");

      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (let i = 0; i < lines; i++) {
        const y0 = i * gap;
        // each line is a slightly different, slow superposition of sine waves
        const a1 = 22 + 10 * Math.sin(i * 0.5 + t * 0.2);
        const a2 = 12 + 6 * Math.cos(i * 0.37 - t * 0.15);
        const a3 = 6;
        const k1 = 0.0042 + 0.0006 * Math.sin(i * 0.3);
        const k2 = 0.0095;
        const k3 = 0.021;
        const ph = i * 0.42;
        ctx.beginPath();
        for (let x = -step; x <= W + step; x += step) {
          const env = 0.55 + 0.45 * Math.sin(x * 0.0016 + t * 0.12 + i * 0.2); // swells drift along the line
          const y =
            y0 +
            env * a1 * Math.sin(x * k1 + t * 0.55 + ph) +
            a2 * Math.sin(x * k2 - t * 0.42 + ph * 1.6) +
            a3 * Math.sin(x * k3 + t * 0.8 + ph * 2.3);
          if (x <= 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        // brightness rolls slowly down the screen, like light moving over water
        const glow = 0.5 + 0.5 * Math.sin(i * 0.28 - t * 0.35);
        ctx.globalAlpha = 0.05 + 0.12 * glow;
        ctx.strokeStyle = gx;
        ctx.lineWidth = 1 + glow * 0.9;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    if (reduce) {
      t = 3;
      frame(performance.now());
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return <canvas ref={ref} className="wave-bg" aria-hidden="true" />;
}
