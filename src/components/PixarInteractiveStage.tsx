import { useEffect, useRef, useState } from "react";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

interface PixarInteractiveStageProps {
  theme?: "gold" | "silver" | "violet";
}

/**
 * High-End 3D-Like Structure of Muhammad Ali:
 * - Hand-crafted Pixar character (dark wavy curtain hair, moustache, silver hoop earrings, straight black shirt, no mole)
 * - Eyes and pupils actively follow where the mouse goes in real time (gaze tracking)
 * - Natural eyelid blinking loop
 * - Face and torso smoothly tilt in 3D perspective with inertia
 * - Dynamic studio specular lighting following the cursor
 * - NO "HI, I'M ALI" in the background (as requested)
 * - Reference style floating cursor, bottom-left editorial lede, and glowing gradient contact pill
 */
export default function PixarInteractiveStage({ theme = "gold" }: PixarInteractiveStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headStageRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);
  const eyeLRef = useRef<HTMLDivElement>(null);
  const eyeRRef = useRef<HTMLDivElement>(null);
  const eyelidLRef = useRef<HTMLDivElement>(null);
  const eyelidRRef = useRef<HTMLDivElement>(null);

  const [isBlinking, setIsBlinking] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Eyelid blinking loop
  useEffect(() => {
    let blinkTimer: any;
    const scheduleBlink = () => {
      const delay = 2600 + Math.random() * 2400; // 2.6s - 5s
      blinkTimer = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 160); // 160ms blink duration
      }, delay);
    };

    scheduleBlink();
    return () => clearTimeout(blinkTimer);
  }, []);

  // 3D Tilt and Eye Gaze Tracking Loop
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    let dragDeltaX = 0;
    let dragDeltaY = 0;
    let startX = 0;
    let startY = 0;
    let dragging = false;

    let targetLightX = 50;
    let targetLightY = 50;
    let currentLightX = 50;
    let currentLightY = 50;

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const rect = container.getBoundingClientRect();
      // Normalized between -1 and 1
      const normX = clamp(((clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
      const normY = clamp(((clientY - rect.top) / rect.height - 0.5) * 2, -1, 1);

      if (dragging) {
        const dx = clientX - startX;
        const dy = clientY - startY;
        dragDeltaX = clamp((dx / rect.width) * 55, -45, 45);
        dragDeltaY = clamp(-(dy / rect.height) * 45, -35, 35);
      } else {
        targetX = normX;
        targetY = normY;
      }

      targetLightX = ((clientX - rect.left) / rect.width) * 100;
      targetLightY = ((clientY - rect.top) / rect.height) * 100;
    };

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      dragging = true;
      setIsDragging(true);
      const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      startX = clientX;
      startY = clientY;
    };

    const onPointerUp = () => {
      dragging = false;
      setIsDragging(false);
      dragDeltaX *= 0.25;
      dragDeltaY *= 0.25;
    };

    const onMouseLeave = () => {
      dragging = false;
      setIsDragging(false);
      targetX = 0;
      targetY = 0;
      dragDeltaX = 0;
      dragDeltaY = 0;
      targetLightX = 50;
      targetLightY = 40;
    };

    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    container.addEventListener("mousedown", onPointerDown);
    container.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("mouseup", onPointerUp);
    window.addEventListener("touchend", onPointerUp);
    container.addEventListener("mouseleave", onMouseLeave);

    let rafId: number;
    let time = 0;

    const tick = () => {
      time += 0.035;

      // Subtle breathing motion
      const breath = Math.sin(time * 1.5) * 1.2;

      // Interpolate face tilt
      const destX = (dragging ? dragDeltaX / 25 : targetX);
      const destY = (dragging ? -dragDeltaY / 25 : targetY);

      currentX += (destX - currentX) * 0.085;
      currentY += (destY - currentY) * 0.085;

      currentLightX += (targetLightX - currentLightX) * 0.1;
      currentLightY += (targetLightY - currentLightY) * 0.1;

      // 1. Move face & torso in 3D perspective
      if (headStageRef.current) {
        const rotY = currentX * 22; // up to ±22 deg turn
        const rotX = -currentY * 16 + breath; // up to ±16 deg tilt
        const transX = currentX * 12;
        const transY = currentY * 8;

        headStageRef.current.style.transform = `
          perspective(1100px)
          rotateX(${rotX.toFixed(2)}deg)
          rotateY(${rotY.toFixed(2)}deg)
          translate3d(${transX.toFixed(1)}px, ${transY.toFixed(1)}px, 24px)
        `;
      }

      // 2. Move eyes (pupils + irises) to track where mouse goes!
      // Eyes have greater sensitivity and parallax than head
      const eyeGx = currentX * 9.5; // pixel gaze shift
      const eyeGy = currentY * 7.5;

      if (eyeLRef.current) {
        eyeLRef.current.style.transform = `translate3d(${eyeGx.toFixed(1)}px, ${eyeGy.toFixed(1)}px, 0)`;
      }
      if (eyeRRef.current) {
        eyeRRef.current.style.transform = `translate3d(${eyeGx.toFixed(1)}px, ${eyeGy.toFixed(1)}px, 0)`;
      }

      // 3. Dynamic specular highlight
      if (lightRef.current) {
        lightRef.current.style.background = `radial-gradient(
          circle 480px at ${currentLightX.toFixed(1)}% ${currentLightY.toFixed(1)}%,
          rgba(255, 255, 255, 0.16) 0%,
          rgba(245, 158, 11, 0.08) 35%,
          transparent 70%
        )`;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("touchmove", onPointerMove);
      container.removeEventListener("mousedown", onPointerDown);
      container.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("touchend", onPointerUp);
      container.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <div
      className={`pixar-hero-stage interactive-face-stage ${isDragging ? "is-dragging" : ""}`}
      ref={containerRef}
    >
      {/* Studio Specular Light Tracker */}
      <div className="stage-specular-light" ref={lightRef} />

      {/* Ambient Depth Glow */}
      <div className="stage-ambient-glow" />

      {/* (NO "HI, I'M ALI" - REMOVED AS REQUESTED!) */}

      {/* 3D Structure of Muhammad Ali with Moveable Face & Eyes */}
      <div className="interactive-character-stage" ref={headStageRef}>
        {/* Base 3D Character (Straight Body, Dark Shirt, Moustache, Wavy Hair) */}
        <div className="character-portrait-box">
          <img
            src="/ali_pixar_cutout.png"
            alt="Muhammad Ali - Interactive 3D Character"
            className="character-main-img"
            draggable={false}
          />

          {/* Interactive Left Eye Socket (Pupil + Iris following mouse) */}
          <div className="eye-aperture eye-left">
            <div className="eye-eyeball" ref={eyeLRef}>
              <div className="eye-iris">
                <div className="eye-pupil" />
                <div className="eye-glint" />
              </div>
            </div>
            {/* Eyelid for natural blinking */}
            <div
              className={`eye-lid lid-top ${isBlinking ? "blink-close" : ""}`}
              ref={eyelidLRef}
            />
          </div>

          {/* Interactive Right Eye Socket (Pupil + Iris following mouse) */}
          <div className="eye-aperture eye-right">
            <div className="eye-eyeball" ref={eyeRRef}>
              <div className="eye-iris">
                <div className="eye-pupil" />
                <div className="eye-glint" />
              </div>
            </div>
            {/* Eyelid for natural blinking */}
            <div
              className={`eye-lid lid-top ${isBlinking ? "blink-close" : ""}`}
              ref={eyelidRRef}
            />
          </div>

          {/* Soft 3D Lighting Sheen Overlay */}
          <div className="character-lighting-sheen" />
        </div>
      </div>

      {/* Bottom Left Editorial Lede */}
      <div className="pixar-bottom-lede">
        <p>A FULL-STACK DEVELOPER &amp;</p>
        <p>AI RESEARCHER CRAFTING LOW-LEVEL</p>
        <p>KERNELS &amp; SCALABLE PRODUCTS</p>
      </div>

      {/* Bottom Right Glowing Gradient "CONTACT ME" Pill */}
      <a href="#contact" className="pixar-contact-pill">
        <span>CONTACT ME</span>
      </a>

      {/* Interactive Status Pill */}
      <div className="pixar-3d-badge">
        <span className="live-dot" />
        <span>Interactive Face &amp; Eyes · Follows Cursor</span>
      </div>
    </div>
  );
}
