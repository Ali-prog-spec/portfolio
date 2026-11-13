import { useEffect, useRef, useState } from "react";

interface PixarHeroStageProps {
  theme?: "gold" | "silver" | "violet";
}

export default function PixarHeroStage({ theme = "gold" }: PixarHeroStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textBackdropRef = useRef<HTMLDivElement>(null);
  const characterRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Movement tracking state
    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;

    let dragDeltaX = 0;
    let dragDeltaY = 0;
    let startX = 0;
    let startY = 0;
    let dragging = false;

    let targetLightX = 50;
    let targetLightY = 50;
    let currentLightX = 50;
    let currentLightY = 50;

    let cursorTargetX = 0;
    let cursorTargetY = 0;
    let cursorCurrentX = 0;
    let cursorCurrentY = 0;

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const rect = container.getBoundingClientRect();
      const normX = (clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
      const normY = (clientY - rect.top) / rect.height - 0.5; // -0.5 to 0.5

      if (dragging) {
        const dx = clientX - startX;
        const dy = clientY - startY;
        dragDeltaX = (dx / rect.width) * 70; // High interactive range on drag
        dragDeltaY = -(dy / rect.height) * 55;
      } else {
        targetRotY = normX * 32; // Expanded turn range: ±32 deg
        targetRotX = -normY * 22; // Expanded tilt range: ±22 deg
      }

      targetLightX = ((clientX - rect.left) / rect.width) * 100;
      targetLightY = ((clientY - rect.top) / rect.height) * 100;

      cursorTargetX = normX * 45;
      cursorTargetY = normY * 35;
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
      // Smooth decay of drag offset back to mouse hover target
      dragDeltaX *= 0.2;
      dragDeltaY *= 0.2;
    };

    const onMouseLeave = () => {
      dragging = false;
      setIsDragging(false);
      targetRotX = 0;
      targetRotY = 0;
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

    const animate = () => {
      time += 0.03;

      // Subtle organic breathing motion
      const breathX = Math.sin(time * 1.5) * 1.2;
      const breathY = Math.cos(time * 1.8) * 1.0;

      const destRotX = (dragging ? dragDeltaY : targetRotX) + breathY;
      const destRotY = (dragging ? dragDeltaX : targetRotY) + breathX;

      // Smooth lag / interpolation
      currentRotX += (destRotX - currentRotX) * 0.1;
      currentRotY += (destRotY - currentRotY) * 0.1;

      currentLightX += (targetLightX - currentLightX) * 0.12;
      currentLightY += (targetLightY - currentLightY) * 0.12;

      cursorCurrentX += (cursorTargetX - cursorCurrentX) * 0.08;
      cursorCurrentY += (cursorTargetY - cursorCurrentY) * 0.08;

      if (characterRef.current) {
        characterRef.current.style.transform = `
          perspective(1100px)
          rotateX(${currentRotX.toFixed(2)}deg)
          rotateY(${currentRotY.toFixed(2)}deg)
          translateZ(35px)
          scale(${dragging ? 1.02 : 1})
        `;
      }

      if (textBackdropRef.current) {
        // Deep 3D reverse parallax on the giant backdrop letters
        textBackdropRef.current.style.transform = `
          translate(-50%, -50%)
          translateX(${(-currentRotY * 2.2).toFixed(1)}px)
          translateY(${(currentRotX * 1.6).toFixed(1)}px)
        `;
      }

      if (lightRef.current) {
        lightRef.current.style.background = `radial-gradient(
          circle 500px at ${currentLightX.toFixed(1)}% ${currentLightY.toFixed(1)}%,
          rgba(255, 255, 255, 0.18) 0%,
          rgba(245, 158, 11, 0.09) 35%,
          transparent 70%
        )`;
      }

      if (cursorRef.current) {
        cursorRef.current.style.transform = `
          translate(${cursorCurrentX.toFixed(1)}px, ${cursorCurrentY.toFixed(1)}px)
        `;
      }

      rafId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("touchmove", onPointerMove);
      container.removeEventListener("mousedown", onPointerDown);
      container.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("touchend", onPointerUp);
      container.removeEventListener("mouseleave", onMouseLeave);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      className={`pixar-hero-stage ${isDragging ? "is-dragging" : ""}`}
      ref={containerRef}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
    >
      {/* Dynamic Specular Light Follower */}
      <div className="stage-specular-light" ref={lightRef} />

      {/* Ambient Depth Grid & Glow */}
      <div className="stage-ambient-glow" />

      {/* Layer 1: Giant Typographic Backdrop matching Reference "HI, I'M JACK" */}
      <div className="pixar-giant-letters" ref={textBackdropRef} aria-hidden="true">
        HI, I'M ALI
      </div>

      {/* Layer 2: The Moveable 3D Character of Muhammad Ali */}
      <div className="pixar-character-wrapper" ref={characterRef}>
        <img
          src="/ali_pixar_cutout.png"
          alt="Muhammad Ali - Moveable 3D Avatar"
          className="pixar-character-img"
          draggable={false}
        />

        {/* 3D Specular Hair Rim Sheen */}
        <div className="pixar-rim-glow" />

        {/* Floating White Reference Pointer (Interactive Follower) */}
        <div className="pixar-ref-cursor" ref={cursorRef} aria-hidden="true">
          <svg
            width="28"
            height="34"
            viewBox="0 0 28 34"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 2L24 16.5L13.5 18L19.5 30.5L14.5 32.5L8.5 20L3 25V2Z"
              fill="#FFFFFF"
              stroke="#0a0a0c"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Layer 3: Bottom Left Editorial Lede (Reference Style) */}
      <div className="pixar-bottom-lede">
        <p>A FULL-STACK DEVELOPER &amp;</p>
        <p>AI RESEARCHER CRAFTING LOW-LEVEL</p>
        <p>KERNELS &amp; SCALABLE PRODUCTS</p>
      </div>

      {/* Layer 4: Bottom Right Glowing Gradient "CONTACT ME" Pill */}
      <a href="#contact" className="pixar-contact-pill">
        <span>CONTACT ME</span>
      </a>

      {/* Interactive Cue Badge */}
      <div className="pixar-3d-badge">
        <span className="live-dot" />
        <span>Moveable Face · Drag or Move Mouse</span>
      </div>
    </div>
  );
}
