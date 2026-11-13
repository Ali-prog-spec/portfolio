import { Component, Suspense, lazy, type ReactNode } from "react";
import PortraitTilt from "./PortraitTilt";

const CartoonAvatar = lazy(() => import("./CartoonAvatar"));

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

/** The hero character: a hand-built glossy 3D cartoon version of me whose eyes follow the cursor. */
export default function HeroModel() {
  return (
    <Boundary>
      <Suspense fallback={<PortraitTilt />}>
        <CartoonAvatar />
      </Suspense>
    </Boundary>
  );
}
