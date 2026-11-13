import { useEffect, useRef } from "react";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Splash loader: your face sits sharp inside a circle while ripples transmit outward from it
 * like a signal, a short voice says "welcome" once at the start, then the whole thing sinks and fades away.
 * onDone fires once it is gone, which is when the live build starts.
 */
export default function Loader({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const muteBtn = useRef<HTMLButtonElement>(null);
  const touch = window.matchMedia("(hover: none)").matches;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onDone();
      return;
    }
    document.body.style.overflow = "hidden";
    const cv = canvas.current!;
    const ctx = cv.getContext("2d")!;
    const S = Math.round(Math.min(560, window.innerWidth * 0.94, window.innerHeight * 0.6));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = cv.height = Math.round(S * dpr);
    cv.style.width = cv.style.height = `${S}px`;
    const W = cv.width;
    const C = W / 2;
    const R = W * (window.innerWidth < 520 ? 0.235 : 0.19); // radius of the face circle

    const SHOW = 3.2; // seconds the face + ripples are shown before it sinks away
    const EXIT = 1.0; // sink + fade

    const img = new Image();
    img.src = "/ali_cutout.png"; // transparent cutout: the face sits cleanly on the dark disc
    let t0 = -1;
    const created = performance.now();
    let exitAt = -1;
    let raf = 0;
    let finished = false;

    // ── welcome voice: tried automatically, once, right at the start ──
    const audio = new Audio("/welcome.mp3");
    audio.preload = "auto";
    audio.volume = 0.95;
    let played = false;
    let blocked = false; // the browser refused autoplay (no interaction with the page yet)
    const tryPlay = () => {
      if (played) return;
      audio
        .play()
        .then(() => {
          played = true;
          blocked = false;
        })
        .catch(() => {
          blocked = true; // stay silent: no prompt; the first interaction during the splash plays it
        });
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      document.body.style.overflow = "";
      onDone();
    };
    const skip = () => {
      if (exitAt < 0) exitAt = performance.now();
    };
    // any interaction skips the splash; if autoplay was blocked it is also the moment sound is allowed
    const onGesture = () => {
      if (blocked && !played) tryPlay();
      skip();
    };
    window.addEventListener("keydown", onGesture);
    root.current!.addEventListener("pointerdown", onGesture);
    const mute = muteBtn.current!;
    const onMute = (e: Event) => {
      e.stopPropagation();
      audio.muted = !audio.muted;
      mute.textContent = audio.muted ? "sound off" : "sound on";
    };
    mute.addEventListener("pointerdown", (e) => e.stopPropagation());
    mute.addEventListener("click", onMute);

    const ring = (r: number, alpha: number, lw: number, k: number, t: number, wobble: number) => {
      ctx.strokeStyle = `rgba(245,158,11,${alpha})`;
      ctx.lineWidth = lw;
      ctx.beginPath();
      const n = 120;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = r * (1 + wobble * Math.sin(a * 7 - t * 3 + k * 1.7));
        const x = C + Math.cos(a) * rr;
        const y = C + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (t0 < 0) {
        if (img.complete && img.naturalWidth) {
          t0 = now;
        } else if (now - created > 2500) {
          t0 = now; // never hang on a slow image
        } else return;
      }
      const t = (now - t0) / 1000;
      if (exitAt < 0 && t > SHOW) exitAt = now;
      const fade = clamp(t / 0.6, 0, 1);

      ctx.clearRect(0, 0, W, W);

      // ── ripples transmitting outward from the circle ──
      const N = 5;
      const speed = 0.34; // rings per second
      for (let k = 0; k < N; k++) {
        const q = (t * speed + k / N) % 1;
        const r = R * 1.1 + q * (C - R * 1.1);
        const a = Math.pow(1 - q, 1.7) * 0.6 * fade;
        ring(r, a, (2.4 - q * 1.6) * dpr, k, t, 0.012 * (1 - q));
        ring(r * 0.965, a * 0.28, 1 * dpr, k + 3, t, 0.01 * (1 - q)); // faint echo
      }

      // ── the face, sharp, in its circle ──
      const pulse = 1 + 0.018 * (0.5 + 0.5 * Math.cos(Math.PI * 2 * speed * t));
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(C, C);
      ctx.scale(pulse, pulse);
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.clip();
      const g = ctx.createRadialGradient(0, -R * 0.2, R * 0.1, 0, 0, R);
      g.addColorStop(0, "#2a1f0c");
      g.addColorStop(1, "#0b0c10");
      ctx.fillStyle = g;
      ctx.fillRect(-R, -R, R * 2, R * 2);
      if (img.complete && img.naturalWidth) {
        const size = R * 2.55;
        ctx.drawImage(img, -size / 2, -size * 0.47 + R * 0.06, size, size);
      }
      ctx.restore();
      // glowing rim
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.shadowColor = "rgba(245,158,11,.75)";
      ctx.shadowBlur = 26 * dpr;
      ctx.strokeStyle = "rgba(245,158,11,.95)";
      ctx.lineWidth = 2.4 * dpr;
      ctx.beginPath();
      ctx.arc(C, C, R * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      bar.current!.style.width = `${clamp(t / SHOW, 0, 1) * 100}%`;

      // ── exit: sink down and fade, then reveal the page ──
      if (exitAt >= 0) {
        const te = clamp((now - exitAt) / 1000 / EXIT, 0, 1);
        const e = te * te * (3 - 2 * te);
        stage.current!.style.transform = `translateY(${e * 110}px) scale(${1 - 0.06 * e})`;
        stage.current!.style.opacity = String(1 - e);
        stage.current!.style.filter = `blur(${e * 9}px)`;
        root.current!.style.opacity = String(1 - clamp((te - 0.3) / 0.7, 0, 1));
        if (te >= 1) {
          cancelAnimationFrame(raf);
          finish();
        }
      }
    };
    tryPlay();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onGesture);
      mute.removeEventListener("click", onMute);
      audio.pause();
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ld-root" ref={root}>
      <button className="ld-mute" ref={muteBtn} type="button">
        sound on
      </button>
      <div className="ld-stage" ref={stage}>
        <canvas ref={canvas} />
        <div className="ld-name">MUHAMMAD ALI</div>
        <div className="ld-sub">full-stack engineer · loading portfolio</div>
        <div className="ld-bar">
          <div ref={bar} />
        </div>
      </div>
      <span className="ld-skip">{touch ? "tap to skip" : "click or press any key to skip"}</span>
    </div>
  );
}
