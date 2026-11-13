import { Component, Suspense, lazy, type ReactNode } from "react";
import PortraitTilt from "./PortraitTilt";

const PersonAvatar = lazy(() => import("./PersonAvatar"));

/** If WebGL is unavailable the hero quietly falls back to the tilt-parallax portrait. */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <PortraitTilt /> : this.props.children;
  }
}

/** The hero character: a hand-built Pixar-style 3D head of me whose eyes follow the cursor. */
export default function HeroModel() {
  return (
    <Boundary>
      <Suspense fallback={<PortraitTilt />}>
        <PersonAvatar />
      </Suspense>
    </Boundary>
  );
}
