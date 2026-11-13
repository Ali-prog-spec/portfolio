import { useState, Suspense, lazy } from "react";
import PixarHeroStage from "./PixarHeroStage";

const Ali3DMeshAvatar = lazy(() => import("./Ali3DMeshAvatar"));

/**
 * The hero character presentation:
 * Defaults to the hyper-polished Pixar 3D character matching the user's reference image,
 * with real-time 3D tilt, specular lighting glints, and the giant backdrop typography.
 * Includes a seamless toggle to the procedural Three.js 360° mesh canvas.
 */
export default function HeroModel() {
  const [mode, setMode] = useState<"pixar" | "mesh">("pixar");

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {mode === "pixar" ? (
        <PixarHeroStage />
      ) : (
        <Suspense
          fallback={
            <div className="stage-loader">
              <span className="spinner" />
              <span>Loading 3D Mesh...</span>
            </div>
          }
        >
          <Ali3DMeshAvatar />
        </Suspense>
      )}

      {/* Mode Switcher Pill */}
      <div className="hero-model-switch" aria-label="3D View Mode">
        <button
          type="button"
          className={`switch-btn ${mode === "pixar" ? "active" : ""}`}
          onClick={() => setMode("pixar")}
          title="Pixar AAA 3D Character (Reference Style)"
        >
          <span className="dot" />
          Pixar 3D
        </button>
        <button
          type="button"
          className={`switch-btn ${mode === "mesh" ? "active" : ""}`}
          onClick={() => setMode("mesh")}
          title="Three.js 3D Mesh with 360° Orbit"
        >
          <span className="dot" />
          Mesh Orbit
        </button>
      </div>
    </div>
  );
}
