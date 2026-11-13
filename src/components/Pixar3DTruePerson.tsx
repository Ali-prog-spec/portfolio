import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { Float, OrbitControls, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

interface Pixar3DTruePersonProps {
  theme?: "gold" | "silver" | "violet";
}

/**
 * The Real 3D Person Mesh:
 * Solid 3D geometry loaded from the sculpted OBJ model with high-resolution PBR textures,
 * dynamic vertex normals, and realistic skin and hair sheen.
 */
function True3DModel({ orbitMode }: { orbitMode: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const { pointer } = useThree();

  // Load 3D model and textures
  const obj = useLoader(OBJLoader, "/models/ali_pixar_3d_person.obj");
  const [colorMap, normalMap] = useLoader(THREE.TextureLoader, [
    "/ali_pixar_cutout.png",
    "/ali_pixar_normal_3d.png",
  ]);

  useMemo(() => {
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.generateMipmaps = true;
    colorMap.minFilter = THREE.LinearMipmapLinearFilter;

    // Apply high-end PBR material to every mesh child
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry.computeVertexNormals();

        mesh.material = new THREE.MeshStandardMaterial({
          map: colorMap,
          normalMap: normalMap,
          normalScale: new THREE.Vector2(0.85, 0.85),
          roughness: 0.35,
          metalness: 0.04,
          transparent: true,
          alphaTest: 0.08,
          side: THREE.DoubleSide,
        });

        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [obj, colorMap, normalMap]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // 1. Subtle idle breathing
    const breath = Math.sin(state.clock.elapsedTime * 1.6) * 0.025;
    groupRef.current.position.y = -0.15 + breath;

    // 2. Active 3D Head & Torso tracking when not in manual 360 orbit mode
    if (!orbitMode) {
      const targetRotY = pointer.x * 0.45; // Turn head left/right in 3D
      const targetRotX = -pointer.y * 0.28; // Tilt head up/down in 3D
      const targetRotZ = -pointer.x * 0.06; // Subtle natural roll

      groupRef.current.rotation.y = THREE.MathUtils.damp(
        groupRef.current.rotation.y,
        targetRotY,
        5.2,
        delta
      );
      groupRef.current.rotation.x = THREE.MathUtils.damp(
        groupRef.current.rotation.x,
        targetRotX,
        5.2,
        delta
      );
      groupRef.current.rotation.z = THREE.MathUtils.damp(
        groupRef.current.rotation.z,
        targetRotZ,
        4.5,
        delta
      );
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.15, 0]} scale={[1.45, 1.45, 1.45]}>
      <primitive object={obj} />
    </group>
  );
}

/**
 * Studio Lighting Setup mimicking the Pixar reference image:
 * Key directional light, soft fill, and dramatic golden/cool rim backlight.
 */
function StudioLights({ theme }: { theme: "gold" | "silver" | "violet" }) {
  const rimColor =
    theme === "silver" ? "#e2e8f0" : theme === "violet" ? "#c084fc" : "#f59e0b";

  return (
    <>
      <ambientLight intensity={0.8} />

      {/* Main Studio Key Light */}
      <directionalLight
        position={[3.0, 4.0, 4.5]}
        intensity={2.0}
        color="#ffffff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      />

      {/* Soft Fill Light */}
      <directionalLight position={[-3.0, 2.0, 3.5]} intensity={0.9} color="#e0e7ff" />

      {/* Rim Backlight tracing hair silhouette and shoulders */}
      <pointLight position={[0, 3.5, -2.5]} intensity={4.5} color={rimColor} distance={8} />

      {/* Chin/Collar Accent Light */}
      <pointLight position={[0, -2.0, 2.5]} intensity={1.2} color={rimColor} distance={5} />
    </>
  );
}

export default function Pixar3DTruePerson({ theme = "gold" }: Pixar3DTruePersonProps) {
  const [orbitMode, setOrbitMode] = useState(false);

  return (
    <div className="pixar-hero-stage true-3d-stage">
      {/* Layer 1: Giant Typographic Backdrop matching Reference "HI, I'M JACK" */}
      <div className="pixar-giant-letters" aria-hidden="true">
        HI, I'M ALI
      </div>

      {/* Layer 2: True 3D Three.js WebGL Canvas */}
      <div className="true-3d-canvas-container">
        <Canvas
          shadows
          camera={{ position: [0, 0.1, 3.8], fov: 42 }}
          gl={{
            antialias: true,
            alpha: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.15,
          }}
        >
          <StudioLights theme={theme} />

          <Suspense
            fallback={
              <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[0.5, 16, 16]} />
                <meshBasicMaterial wireframe color="#f59e0b" />
              </mesh>
            }
          >
            <True3DModel orbitMode={orbitMode} />
          </Suspense>

          <Sparkles count={25} scale={6.0} size={1.8} speed={0.3} opacity={0.35} color="#ffffff" />

          {orbitMode && (
            <OrbitControls
              enablePan={false}
              minDistance={2.2}
              maxDistance={6.0}
              minPolarAngle={Math.PI / 4}
              maxPolarAngle={Math.PI / 2 + 0.15}
            />
          )}
        </Canvas>
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

      {/* 3D Mode & Orbit Controls Pill */}
      <div className="pixar-3d-badge">
        <button
          type="button"
          className={`true-3d-toggle ${orbitMode ? "active" : ""}`}
          onClick={() => setOrbitMode(!orbitMode)}
          title="Toggle 360° Free Camera Orbit"
        >
          <span className="live-dot" />
          <span>{orbitMode ? "Lock Cursor View" : "360° Free Orbit"}</span>
        </button>
        <span className="true-3d-hint">
          {orbitMode ? "Drag to orbit 360°" : "Face follows cursor in 3D"}
        </span>
      </div>
    </div>
  );
}
