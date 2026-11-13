import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

function Model() {
  const { scene } = useGLTF("/avatar.glb");
  const model = useMemo(() => {
    const m = scene.clone(true);
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const k = 2.4 / Math.max(size.x, size.y, size.z);
    m.scale.setScalar(k);
    m.position.copy(center.multiplyScalar(-k));
    return m;
  }, [scene]);
  return <primitive object={model} />;
}

/** Orbitable viewer for a generated .glb: drag to rotate, gentle auto-rotate when idle. */
export default function ModelViewer() {
  return (
    <div className="ali-3d-wrapper">
      <Canvas camera={{ position: [0, 0.1, 4], fov: 32 }} dpr={[1, 2]}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <directionalLight position={[-4, 1, -3]} intensity={1.4} color="#9fb4ff" />
        <Model />
        <ContactShadows position={[0, -1.25, 0]} opacity={0.5} scale={5} blur={2.6} far={2} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1.2} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.8} />
      </Canvas>
    </div>
  );
}
