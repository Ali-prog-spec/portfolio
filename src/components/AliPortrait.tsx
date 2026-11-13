import { useEffect, useRef } from "react";

/**
 * Live portrait: a still picture whose eyes are redrawn each frame so the iris really follows the
 * cursor (or wanders when nobody is pointing) and blinks now and then. The face stays straight.
 * Image space is 896 x 1200 px; everything below is in those pixels.
 */
const IMG_W = 896;
const IMG_H = 1200;

type Eye = { cx: number; cy: number; r: number; ox: number; oy: number; hw: number; path: string; box: [number, number, number, number] };

// eye openings traced from the picture (edge of the lash band) and iris centres
const EYES: Eye[] = [
  { cx: 359, cy: 461, r: 23, ox: 350, oy: 463, hw: 50, path: "M302,463 C306,456 318,449 335,445 C350,441 372,441 386,450 C393,455 397,463 398,470 C392,477 380,483 365,485 C345,487 325,484 313,477 C307,473 303,468 302,463 Z", box: [294, 430, 112, 62] },
  { cx: 537, cy: 461, r: 23, ox: 542, oy: 464, hw: 46, path: "M497,468 C500,460 508,452 522,446 C535,442 555,441 568,447 C578,452 585,458 587,464 C585,472 578,479 565,483 C552,487 535,487 522,484 C510,480 501,474 497,468 Z", box: [490, 430, 104, 62] },
];

// the photo is a smile; a per-column vertical warp closes the lips into a straight, calm mouth
const MX0 = 326, MX1 = 584, MY0 = 588, MY1 = 726;
const UP: [number, number][] = [[326, 631], [350, 632], [380, 636], [400, 639], [450, 641], [500, 637], [530, 633], [545, 631], [558, 630], [584, 630]];
const LO: [number, number][] = [[326, 636], [350, 636], [380, 641], [400, 653], [420, 657], [450, 660], [480, 655], [500, 650], [520, 645], [535, 638], [545, 633], [558, 631], [584, 631]];
const LIP = 30;
const YC = 641;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
const interp = (tb: [number, number][], x: number) => {
  for (let i = 1; i < tb.length; i++) {
    if (x <= tb[i][0]) {
      const a = tb[i - 1], b = tb[i];
      return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
    }
  }
  return tb[tb.length - 1][1];
};

export default function AliPortrait() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvas.current!;
    const vctx = cv.getContext("2d")!;
    const off = document.createElement("canvas");
    off.width = IMG_W;
    off.height = IMG_H;
    const ctx = off.getContext("2d")!;
    const paths = EYES.map((e) => new Path2D(e.path));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const img = new Image();
    let raf = 0;
    let alive = true;

    const drawMouth = () => {
      ctx.drawImage(img, MX0, MY0, MX1 - MX0, MY1 - MY0, MX0, MY0, MX1 - MX0, MY1 - MY0);
      for (let x = MX0; x < MX1; x++) {
        const te = ease((x - MX0) / 34) * ease((MX1 - x) / 34);
        if (te < 0.003) continue;
        const u = interp(UP, x + 0.5), l = interp(LO, x + 0.5);
        const q = Math.min(1, Math.pow((x - 452) / 92, 2));
        const yc = YC + 3.5 * q; // corners sit a touch lower: a calm, straight mouth
        const a1 = u + (yc - u) * te, a2 = l + (yc - l) * te;
        const a3 = l + LIP + (yc - l) * te;
        const segs = [[MY0, u, MY0, a1], [u, l, a1, a2], [l, l + LIP, a2, a3], [l + LIP, MY1, a3, MY1]];
        for (const [s0, s1, d0, d1] of segs) {
          const sh = s1 - s0, dh = d1 - d0;
          if (dh < 0.4 || sh < 0.4) continue;
          ctx.drawImage(img, x, s0, 1, sh, x, d0, 1, dh);
        }
      }
    };

    const irisGradient = (x: number, y: number, r: number) => {
      const g = ctx.createRadialGradient(x, y, r * 0.35, x, y, r);
      g.addColorStop(0, "#a8683a");
      g.addColorStop(0.45, "#7d4a29");
      g.addColorStop(0.82, "#54301b");
      g.addColorStop(1, "#24130a");
      return g;
    };

    const drawEye = (e: Eye, p: Path2D, lx: number, ly: number, bl: number) => {
      const b = e.box;
      ctx.drawImage(img, b[0], b[1], b[2], b[3], b[0], b[1], b[2], b[3]); // restore the photo's pixels
      ctx.save();
      ctx.clip(p);
      // sclera, shaded toward the corners and under the upper lid
      const bb = ctx.createLinearGradient(0, e.oy - 24, 0, e.oy + 24);
      bb.addColorStop(0, "#c9a99a");
      bb.addColorStop(0.3, "#f1ebe5");
      bb.addColorStop(0.8, "#ece2d8");
      bb.addColorStop(1, "#c7a392");
      ctx.fillStyle = bb;
      ctx.fillRect(b[0], b[1], b[2], b[3]);
      const ss = ctx.createRadialGradient(e.ox, e.oy, e.hw * 0.4, e.ox, e.oy, e.hw * 1.05);
      ss.addColorStop(0, "rgba(120,70,50,0)");
      ss.addColorStop(1, "rgba(120,70,50,0.5)");
      ctx.fillStyle = ss;
      ctx.fillRect(b[0], b[1], b[2], b[3]);

      // iris, squashed a little toward the edge like a sphere
      const ix = e.cx + lx * 8, iy = e.cy + ly * 4.5;
      const sq = 1 - 0.16 * Math.abs(lx);
      ctx.beginPath();
      ctx.ellipse(ix, iy, e.r * sq, e.r, 0, 0, Math.PI * 2);
      ctx.fillStyle = irisGradient(ix, iy, e.r);
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = "rgba(210,150,90,0.22)";
      ctx.lineWidth = 0.9;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(ix + Math.cos(a) * e.r * 0.5, iy + Math.sin(a) * e.r * 0.5);
        ctx.lineTo(ix + Math.cos(a) * e.r * 0.92, iy + Math.sin(a) * e.r * 0.92);
        ctx.stroke();
      }
      ctx.restore();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(20,10,5,0.75)";
      ctx.beginPath();
      ctx.ellipse(ix, iy, e.r * sq - 0.8, e.r - 0.8, 0, 0, Math.PI * 2);
      ctx.stroke();
      const pr = e.r * 0.5;
      ctx.fillStyle = "#050303";
      ctx.beginPath();
      ctx.ellipse(ix + lx * 1.5, iy + ly, pr * sq, pr, 0, 0, Math.PI * 2);
      ctx.fill();
      // catchlight stays put on the light side, moving less than the iris
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      ctx.beginPath();
      ctx.ellipse(e.cx + 6 + lx * 4.5, e.cy - 10 + ly * 3, 6.2, 4.3, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.arc(e.cx - 7 + lx * 3, e.cy + 9 + ly * 2, 2, 0, Math.PI * 2);
      ctx.fill();

      // lid rim and the shadow the upper lid casts
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(40,18,10,0.4)";
      ctx.stroke(p);
      const sh = ctx.createLinearGradient(0, e.cy - 26, 0, e.cy - 4);
      sh.addColorStop(0, "rgba(60,25,12,0.62)");
      sh.addColorStop(1, "rgba(60,25,12,0)");
      ctx.fillStyle = sh;
      ctx.fillRect(b[0], b[1], b[2], b[3]);

      // blink: a skin-coloured lid sweeps down, the lower lid rises a little
      if (bl > 0.01) {
        const top = e.cy - 28, h = 56 * bl;
        const lg = ctx.createLinearGradient(0, top, 0, top + h);
        lg.addColorStop(0, "#a9684a");
        lg.addColorStop(1, "#c58562");
        ctx.fillStyle = lg;
        ctx.fillRect(b[0], top, b[2], h);
        ctx.fillStyle = "rgba(25,12,8,0.85)";
        ctx.fillRect(b[0], top + h - 1.6, b[2], 2.2);
        ctx.fillStyle = "#b87858";
        ctx.fillRect(b[0], e.cy + 30 - 14 * bl, b[2], 14 * bl);
      }
      ctx.restore();
    };

    // where the picture sits on screen (the canvas is object-fit: cover, 50% 30%)
    const place = () => {
      const r = cv.getBoundingClientRect();
      const s = Math.max(r.width / IMG_W, r.height / IMG_H);
      return { r, s, ox: r.left + (r.width - IMG_W * s) * 0.5, oy: r.top + (r.height - IMG_H * s) * 0.3 };
    };

    let mouse: { x: number; y: number } | null = null;
    let lastMove = 0;
    const onMove = (ev: PointerEvent) => {
      mouse = { x: ev.clientX, y: ev.clientY };
      lastMove = performance.now();
    };
    const onLeave = () => {
      mouse = null;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    const look = { x: 0, y: 0 };
    let blink = 0, blinkT = -1, nextBlink = 1800 + Math.random() * 2500;
    const t0 = performance.now();
    let prev = t0;

    const draw = (now: number) => {
      const dt = Math.min(64, now - prev);
      prev = now;
      const t = (now - t0) / 1000;
      let tx: number, ty: number;
      if (!mouse || now - lastMove > 3500) {
        tx = Math.sin(t * 0.55) * 0.55 + Math.sin(t * 1.3) * 0.15; // wander when nobody is pointing
        ty = Math.sin(t * 0.4 + 1.2) * 0.25;
      } else {
        const { r, s, ox, oy } = place();
        const aim = (e: Eye) => ({
          x: clamp((mouse!.x - (ox + e.cx * s)) / (r.width * 0.55), -1, 1),
          y: clamp((mouse!.y - (oy + e.cy * s)) / (r.height * 0.45), -1, 1),
        });
        const a = aim(EYES[0]), b = aim(EYES[1]);
        tx = (a.x + b.x) / 2;
        ty = (a.y + b.y) / 2;
      }
      const k = Math.min(1, (1 - Math.pow(0.0009, dt / 1000)) * 1.6);
      look.x += (tx - look.x) * k;
      look.y += (ty - look.y) * k;

      nextBlink -= dt;
      if (nextBlink <= 0 && blinkT < 0) {
        blinkT = 0;
        nextBlink = 2200 + Math.random() * 3800;
      }
      if (blinkT >= 0) {
        blinkT += dt;
        const p = blinkT / 170;
        blink = p < 1 ? p : clamp(2 - p, 0, 1);
        if (p >= 2) {
          blinkT = -1;
          blink = 0;
        }
      }
      EYES.forEach((e, i) => drawEye(e, paths[i], look.x, look.y, blink));
      vctx.drawImage(off, 0, 0);
    };

    // pause while off-screen so it costs nothing when the hero is scrolled away
    let visible = true;
    const io = new IntersectionObserver((en) => {
      visible = en[0].isIntersecting;
    });
    io.observe(cv);
    const loop = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      if (visible) draw(now);
    };

    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      drawMouth();
      draw(performance.now());
      if (!reduce) raf = requestAnimationFrame(loop);
    };
    img.src = "/ali_portrait.jpg";

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className="alive-portrait" ref={wrap}>
      <canvas
        ref={canvas}
        width={IMG_W}
        height={IMG_H}
        role="img"
        aria-label="Portrait of Muhammad Ali: the eyes follow your cursor and blink"
      />
    </div>
  );
}
