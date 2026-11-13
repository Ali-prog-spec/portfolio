import PixarInteractiveStage from "./PixarInteractiveStage";

/**
 * The hero character presentation:
 * Interactive 3D structure of Muhammad Ali matching the Pixar design,
 * with real-time face tilt, moveable eyes that follow the mouse,
 * eyelid blinking, studio lighting, and no backdrop typography.
 */
export default function HeroModel() {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <PixarInteractiveStage />
    </div>
  );
}
