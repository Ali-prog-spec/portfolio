import { Suspense, lazy, useEffect, useState } from "react";
import PortraitTilt from "./PortraitTilt";

const ModelViewer = lazy(() => import("./ModelViewer"));

/**
 * Shows the full 3D model when public/avatar.glb exists (drag to orbit),
 * otherwise falls back to the tilt-parallax portrait.
 */
export default function HeroModel() {
  const [hasGlb, setHasGlb] = useState(false);

  useEffect(() => {
    // Vite serves index.html for unknown paths, so check the content type as well as the status.
    fetch("/avatar.glb", { method: "HEAD" })
      .then((r) => setHasGlb(r.ok && !(r.headers.get("content-type") ?? "").includes("text/html")))
      .catch(() => setHasGlb(false));
  }, []);

  if (!hasGlb) return <PortraitTilt />;
  return (
    <Suspense fallback={<PortraitTilt />}>
      <ModelViewer />
    </Suspense>
  );
}
