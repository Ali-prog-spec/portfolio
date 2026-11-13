import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * A glossy, rounded 3D cartoon character of Muhammad Ali, built entirely from Three.js primitives:
 * wide head, big ears, thick angled brows, heavy-lidded eyes that follow the cursor and blink,
 * round nose, toothy grin, a proper mustache, backwards cap and a dark sweatshirt, lit with
 * teal and magenta rim lights on a dark background.
 */

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ── head surface ────────────────────────────────────────────────────────────────────────────
const PN = 2.7; // >2 squares the sphere off a little, like a toy figure; smooth everywhere

/** maps a point on the unit sphere to the head shape (scale > 1 gives a shell around it) */
function squarify(x: number, y: number, z: number, scale = 1): [number, number, number] {
  const k = 1 / Math.pow(Math.pow(Math.abs(x), PN) + Math.pow(Math.abs(y), PN) + Math.pow(Math.abs(z), PN), 1 / PN);
  let X = x * k;
  const Y = y * k * 0.96;
  let Z = z * k * 0.92;
  X *= 1 + 0.07 * Math.exp(-(((y + 0.25) / 0.45) ** 2)); // full cheeks
  const t = THREE.MathUtils.smoothstep(-y, 0.35, 1.0); // round, slightly tucked chin
  X *= 1 - 0.2 * t;
  Z *= 1 - 0.1 * t;
  return [X * scale, Y * scale, Z * scale];
}

function makeHeadGeometry() {
  const g = new THREE.SphereGeometry(1, 72, 54);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const [X, Y, Z] = squarify(p.getX(i), p.getY(i), p.getZ(i));
    p.setXYZ(i, X, Y, Z);
  }
  g.computeVertexNormals();
  return g;
}

/** height map of the face (z at x,y) so features can be laid exactly onto the surface */
class Surface {
  private N = 72;
  private x0 = -1.15;
  private x1 = 1.15;
  private y0 = -1.1;
  private y1 = 1.1;
  private z: Float32Array;
  constructor(geo: THREE.BufferGeometry) {
    const mesh = new THREE.Mesh(geo);
    mesh.updateMatrixWorld(true);
    const rc = new THREE.Raycaster();
    const dir = new THREE.Vector3(0, 0, -1);
    this.z = new Float32Array(this.N * this.N).fill(0);
    for (let j = 0; j < this.N; j++)
      for (let i = 0; i < this.N; i++) {
        const x = this.x0 + ((this.x1 - this.x0) * i) / (this.N - 1);
        const y = this.y0 + ((this.y1 - this.y0) * j) / (this.N - 1);
        rc.set(new THREE.Vector3(x, y, 3), dir);
        const hit = rc.intersectObject(mesh, false)[0];
        this.z[j * this.N + i] = hit ? hit.point.z : 0;
      }
  }
  zAt(x: number, y: number) {
    const fx = ((x - this.x0) / (this.x1 - this.x0)) * (this.N - 1);
    const fy = ((y - this.y0) / (this.y1 - this.y0)) * (this.N - 1);
    const i = clamp(Math.floor(fx), 0, this.N - 2), j = clamp(Math.floor(fy), 0, this.N - 2);
    const tx = fx - i, ty = fy - j;
    const a = this.z[j * this.N + i], b = this.z[j * this.N + i + 1];
    const c = this.z[(j + 1) * this.N + i], d = this.z[(j + 1) * this.N + i + 1];
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
  }
  normalAt(x: number, y: number) {
    const h = 0.02;
    const dzdx = (this.zAt(x + h, y) - this.zAt(x - h, y)) / (2 * h);
    const dzdy = (this.zAt(x, y + h) - this.zAt(x, y - h)) / (2 * h);
    return new THREE.Vector3(-dzdx, -dzdy, 1).normalize();
  }
  /** a point on the surface pushed out along the normal */
  point(x: number, y: number, off = 0) {
    return new THREE.Vector3(x, y, this.zAt(x, y)).addScaledVector(this.normalAt(x, y), off);
  }
  quat(x: number, y: number) {
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.normalAt(x, y));
  }
  /** conform every vertex of a flat/extruded geometry onto the surface (keeps its own depth on top) */
  conform(g: THREE.BufferGeometry, cx: number, cy: number, off = 0) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const X = cx + p.getX(i), Y = cy + p.getY(i);
      p.setXYZ(i, X, Y, this.zAt(X, Y) + off + p.getZ(i));
    }
    g.computeVertexNormals();
    return g;
  }
}

// ── feature shapes ─────────────────────────────────────────────────────────────────────────
function mustacheGeometry(s: Surface) {
  const sh = new THREE.Shape();
  sh.moveTo(-0.34, -0.1);
  sh.bezierCurveTo(-0.36, 0.06, -0.18, 0.12, 0, 0.07);
  sh.bezierCurveTo(0.18, 0.12, 0.36, 0.06, 0.34, -0.1);
  sh.bezierCurveTo(0.28, -0.05, 0.14, -0.09, 0, -0.05);
  sh.bezierCurveTo(-0.14, -0.09, -0.28, -0.05, -0.34, -0.1);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelSize: 0.022, bevelThickness: 0.03, bevelSegments: 4, curveSegments: 28 });
  return s.conform(g, 0, -0.44, 0.015);
}

function smileShape(w: number, top: number, bottom: number) {
  const sh = new THREE.Shape();
  sh.moveTo(-w, 0.02);
  sh.quadraticCurveTo(0, top, w, 0.02);
  sh.bezierCurveTo(w * 0.92, bottom, -w * 0.92, bottom, -w, 0.02);
  return sh;
}

type Look = { x: number; y: number; blink: number };

const bez = (a: number[], b: number[], c: number[], d: number[]) =>
  new THREE.CubicBezierCurve3(new THREE.Vector3(...(a as [number, number, number])), new THREE.Vector3(...(b as [number, number, number])), new THREE.Vector3(...(c as [number, number, number])), new THREE.Vector3(...(d as [number, number, number])));

/** an almond-shaped, heavy-lidded eye opening; sclera and iris are only drawn inside it (stencil) */
function Eye({ side, look, surf }: { side: -1 | 1; look: React.MutableRefObject<Look>; surf: Surface }) {
  const iris = useRef<THREE.Group>(null);
  const lids = useRef<THREE.Group>(null);
  const lines = useRef<THREE.Group>(null);
  const ref = side === -1 ? 1 : 2;
  const cx = side * 0.38, cy = 0.07;
  const pos = useMemo(() => surf.point(cx, cy, 0.012), [surf, cx]);
  const quat = useMemo(() => surf.quat(cx, cy), [surf, cx]);
  const g = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.21, -0.005);
    sh.bezierCurveTo(-0.13, 0.05, 0.1, 0.058, 0.21, 0.0);
    sh.bezierCurveTo(0.12, -0.085, -0.12, -0.095, -0.21, -0.005);
    return {
      mask: new THREE.ShapeGeometry(sh, 32),
      top: new THREE.TubeGeometry(bez([-0.215, -0.006, 0], [-0.13, 0.05, 0], [0.1, 0.058, 0], [0.215, 0.0, 0]), 30, 0.0105, 6),
      bottom: new THREE.TubeGeometry(bez([0.2, -0.002, 0], [0.12, -0.085, 0], [-0.12, -0.095, 0], [-0.2, -0.006, 0]), 30, 0.006, 5),
      crease: new THREE.TubeGeometry(bez([-0.2, 0.03, 0], [-0.13, 0.095, 0], [0.1, 0.1, 0], [0.2, 0.04, 0]), 30, 0.0055, 5),
    };
  }, []);

  useFrame(() => {
    const l = look.current;
    if (iris.current) {
      iris.current.position.x = clamp(l.x * 0.07, -0.07, 0.07);
      iris.current.position.y = clamp(l.y * 0.04, -0.02, 0.03) - 0.02;
    }
    const sy = 1 - l.blink * 0.92; // blink
    if (lids.current) lids.current.scale.y = sy;
    if (lines.current) lines.current.scale.y = sy;
  });

  const keep = { stencilWrite: true, stencilRef: ref, stencilFunc: THREE.EqualStencilFunc } as const;
  return (
    <group position={pos} quaternion={quat} scale={1.7}>
      <group rotation-z={side * 0.14}>
        {/* the opening itself writes the stencil */}
        <group ref={lids}>
          <mesh geometry={g.mask} renderOrder={10} position-z={0.002}>
            <meshBasicMaterial colorWrite={false} depthWrite={false} stencilWrite stencilRef={ref} stencilFunc={THREE.AlwaysStencilFunc} stencilZPass={THREE.ReplaceStencilOp} />
          </mesh>
        </group>
        <mesh renderOrder={11} position-z={0.004} scale={[0.34, 0.2, 1]}>
          <circleGeometry args={[1, 40]} />
          <meshBasicMaterial color="#ebe8f5" {...keep} />
        </mesh>
        <group ref={iris} position-z={0.008}>
          <mesh renderOrder={11}>
            <circleGeometry args={[0.082, 40]} />
            <meshBasicMaterial color="#5a37b8" {...keep} />
          </mesh>
          <mesh renderOrder={11} position-z={0.001}>
            <circleGeometry args={[0.055, 36]} />
            <meshBasicMaterial color="#2f1c78" {...keep} />
          </mesh>
          <mesh renderOrder={11} position-z={0.002}>
            <circleGeometry args={[0.032, 32]} />
            <meshBasicMaterial color="#0b0718" {...keep} />
          </mesh>
          <mesh renderOrder={11} position={[0.03, 0.032, 0.004]}>
            <circleGeometry args={[0.02, 20]} />
            <meshBasicMaterial color="#ffffff" {...keep} />
          </mesh>
          <mesh renderOrder={11} position={[-0.03, -0.026, 0.004]}>
            <circleGeometry args={[0.009, 16]} />
            <meshBasicMaterial color="#e8dcff" {...keep} />
          </mesh>
        </group>
        {/* lid lines (they close on a blink) */}
        <group ref={lines} position-z={0.012}>
          <mesh geometry={g.top} renderOrder={12}>
            <meshBasicMaterial color="#25100c" />
          </mesh>
          <mesh geometry={g.bottom} renderOrder={12}>
            <meshBasicMaterial color="#7a4630" />
          </mesh>
          <mesh geometry={g.crease} renderOrder={12}>
            <meshBasicMaterial color="#9a5a3c" transparent opacity={0.7} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Brow({ side, surf, mat }: { side: -1 | 1; surf: Surface; mat: THREE.Material }) {
  const cx = side * 0.37, cy = 0.4;
  const pos = useMemo(() => surf.point(cx, cy, 0.075), [surf, cx]);
  const quat = useMemo(() => surf.quat(cx, cy), [surf, cx]);
  return (
    <group position={pos} quaternion={quat}>
      <group rotation-z={side * -0.3}>
        <mesh rotation-z={Math.PI / 2} scale={[1, 1, 0.55]} material={mat}>
          <capsuleGeometry args={[0.072, 0.36, 8, 18]} />
        </mesh>
      </group>
    </group>
  );
}

function Character() {
  const head = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const look = useRef<Look>({ x: 0, y: 0, blink: 0 });
  const mouse = useRef({ x: 0, y: 0 });
  const nextBlink = useRef(2.2);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouse.current.x = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
      mouse.current.y = clamp(-((e.clientY / window.innerHeight) * 2 - 1), -1, 1);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const { surf, headGeo } = useMemo(() => {
    const headGeo = makeHeadGeometry();
    return { surf: new Surface(headGeo), headGeo };
  }, []);

  const mats = useMemo(() => {
    const phys = (color: string, rough: number, clear = 0.3) =>
      new THREE.MeshPhysicalMaterial({ color, roughness: rough, clearcoat: clear, clearcoatRoughness: 0.45, sheen: 0.4, sheenColor: new THREE.Color("#ffb08a") });
    return {
      skin: phys("#c98a60", 0.5, 0.35),
      ear: phys("#bd7a52", 0.55, 0.25),
      earIn: phys("#8e5236", 0.7, 0.1),
      black: new THREE.MeshPhysicalMaterial({ color: "#0e0d10", roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
      cap: new THREE.MeshPhysicalMaterial({ color: "#eeeef3", roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
      seam: new THREE.MeshStandardMaterial({ color: "#b9bac4", roughness: 0.6 }),
      shirt: new THREE.MeshStandardMaterial({ color: "#2f2f34", roughness: 0.92 }),
      collar: new THREE.MeshStandardMaterial({ color: "#19191c", roughness: 0.85 }),
      mouthDark: new THREE.MeshBasicMaterial({ color: "#2a0f12", side: THREE.DoubleSide }),
      lip: new THREE.MeshBasicMaterial({ color: "#7a3a2c", side: THREE.DoubleSide }),
      teeth: new THREE.MeshBasicMaterial({ color: "#f3f3f7", side: THREE.DoubleSide }),
      toothLine: new THREE.MeshBasicMaterial({ color: "#b6b6c2" }),
      nostril: new THREE.MeshBasicMaterial({ color: "#6b3a26" }),
    };
  }, []);

  const geo = useMemo(() => {
    const mouthY = -0.66;
    const conf = (g: THREE.BufferGeometry, y: number, off: number) => surf.conform(g, 0, y, off);
    const lipG = conf(new THREE.ShapeGeometry(smileShape(0.34, -0.03, -0.3), 32), mouthY, 0.02);
    const cavG = conf(new THREE.ShapeGeometry(smileShape(0.31, -0.035, -0.27), 32), mouthY, 0.026);
    const teethG = conf(new THREE.ShapeGeometry(smileShape(0.29, -0.04, -0.24), 32), mouthY, 0.03);
    const midLine = conf(new THREE.PlaneGeometry(0.011, 0.085), mouthY - 0.05, 0.035);
    const split = conf(new THREE.PlaneGeometry(0.46, 0.011), mouthY - 0.075, 0.036);
    const teethV = [-0.16, 0.16].map((x) => surf.conform(new THREE.PlaneGeometry(0.008, 0.08), x, mouthY - 0.045, 0.035));
    return { mustache: mustacheGeometry(surf), lipG, cavG, teethG, midLine, split, teethV };
  }, [surf]);

  const capParts = useMemo(() => {
    const CS = 1.075; // the cap is the head's shape, a little bigger, so it always fits over it
    const DH = 1.14; // dome height multiplier: a tall, rounded cap
    const target = 0.66 / 1; // height of the cap's lower edge: clear forehead above the brows below it
    let thetaMax = 1.2;
    for (let th = 0.3; th < 1.5; th += 0.004) {
      if (squarify(Math.sin(th), Math.cos(th), 0, CS)[1] * DH <= target) {
        thetaMax = th;
        break;
      }
    }
    const dome = new THREE.SphereGeometry(1, 72, 40, 0, Math.PI * 2, 0, thetaMax);
    const dp = dome.attributes.position;
    for (let i = 0; i < dp.count; i++) {
      const [X, Y, Z] = squarify(dp.getX(i), dp.getY(i), dp.getZ(i), CS);
      dp.setXYZ(i, X, Y * DH, Z);
    }
    dome.computeVertexNormals();
    const seams: THREE.TubeGeometry[] = [];
    for (let k = 0; k < 6; k++) {
      const phi = (k / 6) * Math.PI * 2;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 16; i++) {
        const th = (i / 16) * thetaMax;
        const [X, Y, Z] = squarify(Math.sin(th) * Math.cos(phi), Math.cos(th), Math.sin(th) * Math.sin(phi), CS * 1.006);
        pts.push(new THREE.Vector3(X, Y * DH, Z));
      }
      seams.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 26, 0.007, 5));
    }
    // the black band follows the dome's lower edge exactly
    const ring: THREE.Vector3[] = [];
    const seg = 96;
    for (let j = 0; j < seg; j++) {
      const phi = (j / seg) * Math.PI * 2;
      const [X, Y, Z] = squarify(Math.sin(thetaMax) * Math.cos(phi), Math.cos(thetaMax), Math.sin(thetaMax) * Math.sin(phi), CS * 1.004);
      ring.push(new THREE.Vector3(X, Y * DH, Z));
    }
    const band = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ring, true), 160, 0.04, 10, true);
    const topY = squarify(0, 1, 0, CS * 1.006)[1] * DH;
    return { dome, seams, band, topY };
  }, []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const mx = mouse.current.x, my = mouse.current.y;
    const h = head.current!, b = body.current!;
    h.rotation.y = THREE.MathUtils.damp(h.rotation.y, mx * 0.4 + Math.sin(t * 0.5) * 0.03, 4, dt);
    h.rotation.x = THREE.MathUtils.damp(h.rotation.x, -my * 0.18, 4, dt);
    h.rotation.z = Math.sin(t * 0.7) * 0.012;
    b.rotation.y = THREE.MathUtils.damp(b.rotation.y, mx * 0.1, 3, dt);
    b.scale.y = 1 + Math.sin(t * 1.5) * 0.006;
    look.current.x = THREE.MathUtils.damp(look.current.x, mx, 9, dt);
    look.current.y = THREE.MathUtils.damp(look.current.y, my, 9, dt);
    if (t > nextBlink.current) nextBlink.current = t + 2.6 + Math.random() * 2.8;
    const since = t - (nextBlink.current - 0.16);
    look.current.blink = since > 0 && since < 0.16 ? Math.sin((since / 0.16) * Math.PI) : 0;
  });

  const noseP = useMemo(() => surf.point(0, -0.17, 0.12), [surf]);
  const earY = -0.08;

  return (
    <group position={[0, -0.1, 0]}>
      {/* ── body: dark sweatshirt ── */}
      <group ref={body}>
        <mesh position={[0, -2.55, -0.05]} scale={[2.35, 1.5, 1.1]} material={mats.shirt}>
          <sphereGeometry args={[1, 64, 48]} />
        </mesh>
        <mesh position={[0, -1.18, -0.04]} material={mats.skin}>
          <cylinderGeometry args={[0.5, 0.6, 0.7, 40]} />
        </mesh>
        <mesh position={[0, -1.5, -0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.86, 1]} material={mats.collar}>
          <torusGeometry args={[0.62, 0.12, 20, 56]} />
        </mesh>
      </group>

      {/* ── head ── */}
      <group ref={head}>
        <mesh geometry={headGeo} material={mats.skin} />

        {/* ears */}
        {([-1, 1] as const).map((s) => (
          <group key={s} position={[s * 1.0, earY, -0.06]} rotation-y={s * 0.32}>
            <mesh scale={[0.16, 0.36, 0.26]} material={mats.ear}>
              <sphereGeometry args={[1, 32, 24]} />
            </mesh>
            <mesh position={[s * 0.03, -0.01, 0.07]} scale={[0.09, 0.24, 0.13]} material={mats.earIn}>
              <sphereGeometry args={[1, 24, 18]} />
            </mesh>
          </group>
        ))}

        {/* brows, eyes */}
        <Brow side={-1} surf={surf} mat={mats.black} />
        <Brow side={1} surf={surf} mat={mats.black} />
        <Eye side={-1} look={look} surf={surf} />
        <Eye side={1} look={look} surf={surf} />

        {/* nose: a round ball, like the reference */}
        <mesh position={noseP} scale={[1, 0.93, 1]} material={mats.skin}>
          <sphereGeometry args={[0.185, 40, 32]} />
        </mesh>
        {([-1, 1] as const).map((s) => (
          <mesh key={s} position={[s * 0.07, -0.3, noseP.z + 0.0]} scale={[1, 0.6, 0.4]} material={mats.nostril}>
            <sphereGeometry args={[0.03, 12, 10]} />
          </mesh>
        ))}

        {/* mustache */}
        <mesh geometry={geo.mustache} material={mats.black} />

        {/* toothy grin */}
        <mesh geometry={geo.lipG} material={mats.lip} />
        <mesh geometry={geo.cavG} material={mats.mouthDark} />
        <mesh geometry={geo.teethG} material={mats.teeth} />
        <mesh geometry={geo.split} material={mats.toothLine} />
        <mesh geometry={geo.midLine} material={mats.toothLine} />
        {geo.teethV.map((g, i) => (
          <mesh key={i} geometry={g} material={mats.toothLine} />
        ))}

        {/* sideburns peeking out under the cap */}
        {([-1, 1] as const).map((s) => (
          <mesh key={s} position={[s * 0.9, 0.36, 0.2]} rotation-z={s * 0.05} scale={[0.6, 1, 0.8]} material={mats.black}>
            <capsuleGeometry args={[0.055, 0.22, 6, 12]} />
          </mesh>
        ))}

        {/* backwards cap */}
        <group position={[0, 0.0, -0.02]}>
          <mesh geometry={capParts.dome} material={mats.cap} />
          {capParts.seams.map((g, i) => (
            <mesh key={i} geometry={g} material={mats.seam} />
          ))}
          <mesh geometry={capParts.band} material={mats.black} />
          <mesh position={[0, capParts.topY + 0.01, 0]} material={mats.seam}>
            <sphereGeometry args={[0.05, 16, 12]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** dark backdrop with a soft teal glow behind the character */
function Backdrop() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 512;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(256, 230, 10, 256, 230, 250);
    g.addColorStop(0, "rgba(40,210,200,0.65)");
    g.addColorStop(0.45, "rgba(30,150,170,0.28)");
    g.addColorStop(1, "rgba(20,60,90,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <>
      <mesh position={[0, 0, -4]}>
        <planeGeometry args={[20, 15]} />
        <meshBasicMaterial color="#0a0e15" />
      </mesh>
      <mesh position={[0, 0.2, -3.2]}>
        <planeGeometry args={[9, 9]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </>
  );
}

export default function CartoonAvatar() {
  return (
    <div className="ali-3d-wrapper">
      <Canvas camera={{ position: [0, -0.35, 7.0], fov: 31 }} dpr={[1, 2]} gl={{ antialias: true, stencil: true }}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[2.5, 3.5, 5]} intensity={2.6} color="#fff1e4" />
        <directionalLight position={[-4, 0.5, 3]} intensity={0.7} color="#ffd9c4" />
        <directionalLight position={[-3.5, 2, -3]} intensity={3.4} color="#28d8cc" />
        <directionalLight position={[3.5, 2.5, -2.5]} intensity={2.8} color="#e8409c" />
        <Backdrop />
        <Character />
      </Canvas>
    </div>
  );
}
