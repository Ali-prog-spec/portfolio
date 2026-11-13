import { useEffect, useRef } from "react";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const smooth = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Splash loader, in two beats:
 *  1. a big "welcome" greeting (Arabic + English) with a short voice, which fades out;
 *  2. your face sharp inside a glowing circle with ripples transmitting outward like a signal,
 *     which then sinks and fades away.
 * onDone fires once it is gone, which is when the live build starts.
 */
export default function Loader({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const greet = useRef<HTMLDivElement>(null);
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

    // timeline (seconds since the splash mounted)
    const GREET = 2.4; // greeting: fades in, holds, fades out
    const GAP = 0.1;
    const PROFILE_IN = 0.7; // profile + waves fade in
    const SHOW_B = 2.5; // how long the profile + waves are shown before sinking away
    const EXIT = 1.0; // sink + fade
    const B0 = GREET + GAP;

    const img = new Image();
    img.src = "/ali_cutout.png"; // transparent cutout: the face sits cleanly on the dark disc
    const start = performance.now();
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
      const t = (now - start) / 1000;
      const tb = Math.max(0, t - B0); // time within the profile beat
      if (exitAt < 0 && tb > SHOW_B) exitAt = now;

      // ── beat 1: the greeting ──
      const gIn = smooth(t / 0.7);
      const gOutP = smooth((t - (GREET - 0.6)) / 0.6);
      const g = gIn * (1 - gOutP);
      const gs = greet.current!;
      gs.style.opacity = String(g);
      gs.style.filter = `blur(${(1 - g) * 12}px)`;
      gs.style.transform = `translateY(${-gOutP * 18}px) scale(${0.94 + 0.06 * gIn + 0.03 * gOutP})`;
      (gs.querySelector(".ld-line") as HTMLElement).style.transform = `scaleX(${smooth(t / 1.1)})`;

      // ── beat 2: the profile with ripples transmitting outward ──
      const fade = smooth(tb / PROFILE_IN);
      ctx.clearRect(0, 0, W, W);
      if (tb > 0) {
        const N = 5;
        const speed = 0.34; // rings per second
        for (let k = 0; k < N; k++) {
          const q = (tb * speed + k / N) % 1;
          const r = R * 1.1 + q * (C - R * 1.1);
          const a = Math.pow(1 - q, 1.7) * 0.6 * fade;
          ring(r, a, (2.4 - q * 1.6) * dpr, k, tb, 0.012 * (1 - q));
          ring(r * 0.965, a * 0.28, 1 * dpr, k + 3, tb, 0.01 * (1 - q)); // faint echo
        }

        // the face, sharp, in its circle
        const pulse = 1 + 0.018 * (0.5 + 0.5 * Math.cos(Math.PI * 2 * speed * tb));
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(C, C);
        ctx.scale(pulse, pulse);
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.clip();
        const g2 = ctx.createRadialGradient(0, -R * 0.2, R * 0.1, 0, 0, R);
        g2.addColorStop(0, "#2a1f0c");
        g2.addColorStop(1, "#0b0c10");
        ctx.fillStyle = g2;
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
      }
      bar.current!.style.width = `${clamp(t / (B0 + SHOW_B), 0, 1) * 100}%`;

      // stage opacity/transform: fade in with the profile beat, sink + fade on exit
      let e = 0;
      if (exitAt >= 0) {
        const te = clamp((now - exitAt) / 1000 / EXIT, 0, 1);
        e = smooth(te);
        root.current!.style.opacity = String(1 - clamp((te - 0.3) / 0.7, 0, 1));
        if (te >= 1) {
          cancelAnimationFrame(raf);
          finish();
        }
      }
      const st = stage.current!;
      st.style.opacity = String(fade * (1 - e));
      st.style.transform = `translateY(${e * 110}px) scale(${1 - 0.06 * e})`;
      st.style.filter = `blur(${e * 9 + (1 - fade) * 6}px)`;
      if (exitAt >= 0) gs.style.opacity = "0"; // skipping mid-greeting: hide it at once
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

      <div className="ld-greet" ref={greet}>
        <div className="ld-ar" lang="ar" dir="rtl">
          أهلاً وسهلاً
        </div>
        <div className="ld-en">WELCOME</div>
        <i className="ld-line" />
      </div>

      <div className="ld-stage" ref={stage} style={{ opacity: 0 }}>
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
