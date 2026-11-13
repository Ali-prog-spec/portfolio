import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, useGLTF } from "@react-three/drei";
import * as THREE from "three";

function Model() {
  const { scene } = useGLTF("/avatar.glb");
  const group = useRef<THREE.Group>(null);

  const model = useMemo(() => {
    const m = scene.clone(true);
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const k = 1.8 / Math.max(size.x, size.y, size.z);
    m.scale.setScalar(k);
    m.position.copy(center.multiplyScalar(-k));
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat) {
          mat.roughness = 0.82;
          mat.metalness = 0;
        }
      }
    });
    return m;
  }, [scene]);

  // gently sways on its own and turns toward the cursor, so the face is always the part you see
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const { x, y } = state.pointer;
    const sway = Math.sin(state.clock.elapsedTime * 0.55) * 0.22;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, sway + x * 0.65, 3.5, dt);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -y * 0.18, 3.5, dt);
  });

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}

/** Your generated 3D model (public/avatar.glb), turning to face the cursor. */
export default function ModelViewer() {
  return (
    <div className="ali-3d-wrapper">
      <Canvas camera={{ position: [0, 0.05, 4.1], fov: 32 }} dpr={[1, 2]}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2.5, 3, 5]} intensity={1.5} color="#fff3e2" />
        <directionalLight position={[-4, 1.5, 2]} intensity={0.9} color="#f59e0b" />
        <directionalLight position={[0, -2, 3]} intensity={0.25} />
        <Model />
        <ContactShadows position={[0, -0.98, 0]} opacity={0.45} scale={4.5} blur={2.8} far={2} />
      </Canvas>
    </div>
  );
}
