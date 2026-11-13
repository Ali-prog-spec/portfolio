import { useEffect, useRef } from "react";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/**
 * Cursor-responsive monochrome portrait: the frame tilts in 3D toward the pointer,
 * a soft highlight slides across it and the eyes shift to follow. Tracks the pointer
 * anywhere on the page, so the portrait "notices" you before you reach it.
 */
export default function PortraitTilt() {
  const stage = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const eyeL = useRef<HTMLDivElement>(null);
  const eyeR = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
      ty = clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
    };
    const onLeave = () => { tx = 0; ty = 0; };

    const tick = () => {
      cx += (tx - cx) * 0.075;
      cy += (ty - cy) * 0.075;
      el.style.transform = `rotateX(${-cy * 5.5}deg) rotateY(${cx * 7}deg) translate3d(${cx * 5}px,${cy * 4}px,0)`;
      shade.current?.style.setProperty("--lx", `${cx * 55}px`);
      shade.current?.style.setProperty("--ly", `${cy * 45}px`);
      [eyeL.current, eyeR.current].forEach((eye, i) => {
        eye?.style.setProperty("--gx", `${cx * (i ? 3.2 : 4)}px`);
        eye?.style.setProperty("--gy", `${cy * 2.2}px`);
      });
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <div className="pt-wrap">
      <div className="pt-stage" ref={stage}>
        <img className="pt-img" src="/ali.png" alt="Muhammad Ali, black and white portrait" draggable={false} />
        <div className="pt-eye left" ref={eyeL} />
        <div className="pt-eye right" ref={eyeR} />
        <div className="pt-shade" ref={shade} />
        <div className="pt-rim" />
      </div>
      <span className="pt-hint">move your cursor · the portrait looks back</span>
    </div>
  );
}
