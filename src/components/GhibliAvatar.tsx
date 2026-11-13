import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * A hand-built, Ghibli-style 3D character of Muhammad Ali: toon-shaded with outlines, layered
 * hair strands (side-swept fringe over the right eye), heavy-lidded eyes that really track the
 * cursor and blink, thick brows, mustache and stubble, black collared shirt.
 * Everything is procedural, no assets.
 */

// ── head geometry helpers (units: head height = 2) ───────────────────────────────────────────
const HX = 0.89;
const HY = 1.0;
const HZ = 0.95;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = THREE.MathUtils.lerp;
const jawS = (y: number) => 1 - 0.15 * THREE.MathUtils.smoothstep(-y, -0.05, 0.95);
const chinFwd = (y: number) => (y < -0.3 ? (-y - 0.3) * 0.07 : 0);

function headGeometry(scale = 1) {
  const g = new THREE.SphereGeometry(1, 80, 60);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const s = jawS(y);
    p.setXYZ(i, x * HX * s * scale, y * HY * scale, (z * HZ * s + (z > 0 ? chinFwd(y) : 0)) * scale);
  }
  g.computeVertexNormals();
  return g;
}

/** z of the face surface at (x, y), used to lay flat features onto the head */
function zAt(x: number, y: number) {
  const s = jawS(y);
  const t = 1 - (x / (HX * s)) ** 2 - y * y;
  return HZ * s * Math.sqrt(Math.max(t, 0)) + chinFwd(y);
}
function normalAt(x: number, y: number) {
  const s = jawS(y);
  return new THREE.Vector3(x / (HX * s) ** 2, y, zAt(x, y) / (HZ * s) ** 2).normalize();
}

/** a flat shape conformed onto the face surface */
function decal(shape: THREE.Shape, cx: number, cy: number, off: number, rotZ = 0, flipX = false) {
  const g = new THREE.ShapeGeometry(shape, 28);
  const p = g.attributes.position;
  const c = Math.cos(rotZ), s = Math.sin(rotZ);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * (flipX ? -1 : 1), y = p.getY(i);
    [x, y] = [x * c - y * s, x * s + y * c];
    const X = cx + x, Y = cy + y;
    p.setXYZ(i, X, Y, zAt(X, Y) + off);
  }
  g.computeVertexNormals();
  return g;
}

// ── toon gradients ───────────────────────────────────────────────────────────────────────────
function gradient(steps: number[]) {
  const d = new Uint8Array(steps.length * 4);
  steps.forEach((s, i) => d.set([s, s, s, 255], i * 4));
  const t = new THREE.DataTexture(d, steps.length, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

// ── hair ─────────────────────────────────────────────────────────────────────────────────────
const P = (lat: number, lon: number, rad = 1.06) => {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  return new THREE.Vector3(rad * HX * Math.cos(la) * Math.sin(lo), rad * HY * Math.sin(la), rad * HZ * Math.cos(la) * Math.cos(lo));
};

function hairCap(rad: number) {
  const rows = 34, cols = 96;
  const table: [number, number][] = [[0, 33], [35, 34], [60, 27], [80, 10], [100, -8], [140, -24], [180, -34]];
  const bottom = (lon: number) => {
    const a = Math.abs(lon);
    for (let i = 0; i < table.length - 1; i++) {
      const [a0, b0] = table[i], [a1, b1] = table[i + 1];
      if (a <= a1) return lerp(b0, b1, (a - a0) / (a1 - a0));
    }
    return table[table.length - 1][1];
  };
  const pos: number[] = [], idx: number[] = [];
  for (let j = 0; j <= cols; j++) {
    const lon = -180 + (360 * j) / cols;
    const lb = bottom(lon);
    for (let i = 0; i <= rows; i++) {
      const lat = 90 + (lb - 90) * (i / rows);
      const v = P(lat, lon, rad);
      pos.push(v.x, v.y, v.z);
    }
  }
  for (let j = 0; j < cols; j++)
    for (let i = 0; i < rows; i++) {
      const a = j * (rows + 1) + i, b = a + 1, c = (j + 1) * (rows + 1) + i, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

type Lock = { pts: [number, number, number?][]; w0: number; w1: number; th: number };

/** a flat, tapering strand of hair following a curve over the scalp */
function lockGeometry(l: Lock, grow = 0, shift = 0, widthScale = 1, lift = 0) {
  const ctrl = l.pts.map(([lat, lon, rad]) => P(lat, lon, (rad ?? 1.08) + lift));
  const curve = new THREE.CatmullRomCurve3(ctrl);
  const N = 30, M = 10;
  const pts = curve.getPoints(N);
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = pts[i];
    const tan = curve.getTangent(t);
    const out = new THREE.Vector3(p.x / (HX * HX), p.y / (HY * HY), p.z / (HZ * HZ)).normalize();
    const wd = tan.clone().cross(out).normalize();
    const w = (lerp(l.w0, l.w1, Math.pow(t, 0.75)) + grow) * widthScale;
    const th = l.th * (1 - 0.55 * t) + grow;
    const c = p.clone().addScaledVector(wd, shift * w);
    for (let k = 0; k < M; k++) {
      const a = (Math.PI * 2 * k) / M;
      const v = c.clone().addScaledVector(wd, Math.cos(a) * w).addScaledVector(out, Math.sin(a) * th);
      pos.push(v.x, v.y, v.z);
    }
  }
  for (let i = 0; i < N; i++)
    for (let k = 0; k < M; k++) {
      const a = i * M + k, b = i * M + ((k + 1) % M), c = (i + 1) * M + k, d = (i + 1) * M + ((k + 1) % M);
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// the fringe sweeps from the left of the crown across the forehead and over the right eye
const LOCKS: { lock: Lock; shine?: boolean }[] = [
  { lock: { pts: [[76, -50, 1.15], [66, -28, 1.2], [54, -6, 1.22], [42, 16, 1.2], [28, 32, 1.16], [12, 42, 1.12]], w0: 0.36, w1: 0.02, th: 0.09 }, shine: true },
  { lock: { pts: [[78, -34, 1.15], [68, -12, 1.21], [56, 10, 1.23], [44, 30, 1.2], [30, 42, 1.16], [14, 50, 1.12]], w0: 0.34, w1: 0.02, th: 0.085 }, shine: true },
  { lock: { pts: [[74, -66, 1.14], [62, -44, 1.19], [48, -20, 1.21], [36, 2, 1.19], [24, 20, 1.15], [10, 32, 1.11]], w0: 0.32, w1: 0.02, th: 0.085 }, shine: true },
  { lock: { pts: [[72, -84, 1.13], [58, -66, 1.17], [44, -48, 1.18], [34, -32, 1.15]], w0: 0.32, w1: 0.03, th: 0.08 }, shine: true },
  { lock: { pts: [[66, -14, 1.18], [52, 6, 1.22], [38, 24, 1.19], [22, 36, 1.15], [6, 40, 1.1]], w0: 0.28, w1: 0.02, th: 0.075 }, shine: true },
  { lock: { pts: [[64, -80, 1.13], [46, -87, 1.14], [26, -92, 1.13], [2, -95, 1.12]], w0: 0.34, w1: 0.04, th: 0.08 }, shine: true },
  { lock: { pts: [[64, 80, 1.13], [46, 87, 1.14], [26, 92, 1.13], [2, 95, 1.12]], w0: 0.34, w1: 0.04, th: 0.08 }, shine: true },
  // tall strands for volume on top
  { lock: { pts: [[46, 26, 1.2], [64, 20, 1.26], [80, 8, 1.26], [86, -60, 1.2]], w0: 0.4, w1: 0.04, th: 0.11 }, shine: true },
  { lock: { pts: [[44, -26, 1.2], [64, -24, 1.25], [80, -32, 1.24], [84, -100, 1.18]], w0: 0.38, w1: 0.04, th: 0.1 } },
  { lock: { pts: [[50, 52, 1.17], [66, 44, 1.21], [80, 30, 1.22], [84, -20, 1.18]], w0: 0.34, w1: 0.04, th: 0.09 }, shine: true },
];

// ── face feature shapes ──────────────────────────────────────────────────────────────────────
function browShape(w: number, th: number) {
  const s = new THREE.Shape();
  s.moveTo(-w, -th * 0.15);
  s.bezierCurveTo(-w * 0.55, th * 0.9, w * 0.35, th * 1.0, w, th * 0.35);
  s.lineTo(w, -th * 0.05);
  s.bezierCurveTo(w * 0.3, th * 0.1, -w * 0.5, -th * 0.35, -w, -th * 0.15);
  s.closePath();
  return s;
}

function mustacheShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.3, -0.07);
  s.bezierCurveTo(-0.27, 0.05, -0.12, 0.085, 0, 0.045);
  s.bezierCurveTo(0.12, 0.085, 0.27, 0.05, 0.3, -0.07);
  s.bezierCurveTo(0.22, -0.035, 0.12, -0.065, 0, -0.04);
  s.bezierCurveTo(-0.12, -0.065, -0.22, -0.035, -0.3, -0.07);
  s.closePath();
  return s;
}

function lipShape(w: number, h: number, bow = 0) {
  const s = new THREE.Shape();
  s.moveTo(-w, 0);
  s.quadraticCurveTo(0, h + bow, w, 0);
  s.quadraticCurveTo(0, -h * 0.55, -w, 0);
  return s;
}

function eyelidShapes() {
  // opening is between these two arcs; the lids are the skin-coloured regions outside them
  const upper = new THREE.Shape();
  upper.moveTo(-0.26, 0.125);
  upper.lineTo(-0.26, 0.0);
  upper.lineTo(-0.185, -0.012);
  upper.bezierCurveTo(-0.14, 0.04, -0.06, 0.062, 0.0, 0.062);
  upper.bezierCurveTo(0.07, 0.062, 0.14, 0.045, 0.19, -0.006);
  upper.lineTo(0.26, 0.0);
  upper.lineTo(0.26, 0.125);
  upper.closePath();
  const lower = new THREE.Shape();
  lower.moveTo(-0.26, -0.11);
  lower.lineTo(-0.26, 0.0);
  lower.lineTo(-0.185, -0.012);
  lower.bezierCurveTo(-0.12, -0.04, -0.05, -0.052, 0.0, -0.052);
  lower.bezierCurveTo(0.07, -0.052, 0.14, -0.035, 0.19, -0.006);
  lower.lineTo(0.26, 0.0);
  lower.lineTo(0.26, -0.11);
  lower.closePath();
  return { upper, lower };
}

const lashCurve = () =>
  new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.2, -0.014, 0),
    new THREE.Vector3(-0.13, 0.036, 0),
    new THREE.Vector3(0, 0.063, 0),
    new THREE.Vector3(0.12, 0.048, 0),
    new THREE.Vector3(0.19, -0.002, 0),
    new THREE.Vector3(0.245, 0.016, 0),
  ]);

// ── pointer shared by all parts (the cursor anywhere on the page) ───────────────────────────
type Look = { x: number; y: number; blink: number };

function Eye({ side, look, skin }: { side: -1 | 1; look: React.MutableRefObject<Look>; skin: THREE.Material }) {
  const iris = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const cx = side * 0.345, cy = 0.05;
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normalAt(cx, cy)), [cx]);
  const pos = useMemo(() => new THREE.Vector3(cx, cy, zAt(cx, cy) + 0.012), [cx]);
  const { upperG, lowerG } = useMemo(() => {
    const { upper, lower } = eyelidShapes();
    return { upperG: new THREE.ShapeGeometry(upper, 24), lowerG: new THREE.ShapeGeometry(lower, 24) };
  }, []);
  const lashG = useMemo(() => new THREE.TubeGeometry(lashCurve(), 28, 0.0105, 6), []);
  const creaseG = useMemo(() => {
    const c = lashCurve().getPoints(20).map((p) => new THREE.Vector3(p.x * 1.02, p.y + 0.052 + 0.02 * (1 - Math.abs(p.x) / 0.25), 0));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(c), 24, 0.0042, 5);
  }, []);

  useFrame(() => {
    const l = look.current;
    if (iris.current) {
      iris.current.position.x = clamp(l.x * 0.085, -0.075, 0.075);
      iris.current.position.y = clamp(l.y * 0.05, -0.022, 0.03) - 0.004;
    }
    if (upper.current) upper.current.position.y = -l.blink * 0.07; // blink: the upper lid closes
  });

  return (
    <group position={pos} quaternion={quat} rotation-z={side * -0.05} scale={1.32}>
      {/* eyeball */}
      <mesh position-z={0.004} scale={[0.2, 0.075, 1]}>
        <circleGeometry args={[1, 40]} />
        <meshBasicMaterial color="#efe7da" />
      </mesh>
      {/* iris + pupil + catchlights follow the cursor */}
      <group ref={iris} position-z={0.008}>
        <mesh>
          <circleGeometry args={[0.066, 40]} />
          <meshBasicMaterial color="#2b1810" />
        </mesh>
        <mesh position-z={0.001}>
          <circleGeometry args={[0.043, 36]} />
          <meshBasicMaterial color="#5a3820" />
        </mesh>
        <mesh position-z={0.002}>
          <circleGeometry args={[0.027, 32]} />
          <meshBasicMaterial color="#0b0605" />
        </mesh>
        <mesh position={[0.024, 0.024, 0.004]}>
          <circleGeometry args={[0.0165, 20]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[-0.022, -0.02, 0.004]}>
          <circleGeometry args={[0.0075, 16]} />
          <meshBasicMaterial color="#fff6e8" />
        </mesh>
      </group>
      {/* lids */}
      <mesh geometry={lowerG} position-z={0.014} material={skin} />
      <group ref={upper} position-z={0.016}>
        <mesh geometry={upperG} material={skin} />
        <mesh geometry={lashG} position-z={0.004}>
          <meshBasicMaterial color="#120a07" />
        </mesh>
        <mesh geometry={creaseG} position-z={0.002}>
          <meshBasicMaterial color="#a96d47" />
        </mesh>
      </group>
    </group>
  );
}

function Character() {
  const head = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const hair = useRef<THREE.Group>(null);
  const look = useRef<Look>({ x: 0, y: 0, blink: 0 });
  const mouse = useRef({ x: 0, y: 0 });
  const nextBlink = useRef(2);

  // the cursor anywhere on the page, normalised around the middle of the screen
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouse.current.x = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
      mouse.current.y = clamp(-((e.clientY / window.innerHeight) * 2 - 1), -1, 1);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const m = useMemo(() => {
    const skinGrad = gradient([196, 228, 255]);
    const hairGrad = gradient([120, 195, 255]);
    const shirtGrad = gradient([120, 190, 255]);
    return {
      skin: new THREE.MeshToonMaterial({ color: "#dca678", gradientMap: skinGrad }),
      skinDark: new THREE.MeshToonMaterial({ color: "#cf966a", gradientMap: skinGrad }),
      hair: new THREE.MeshToonMaterial({ color: "#1d1722", gradientMap: hairGrad, side: THREE.DoubleSide }),
      shine: new THREE.MeshBasicMaterial({ color: "#5d6cab", transparent: true, opacity: 0.8 }),
      shirt: new THREE.MeshToonMaterial({ color: "#1a1b21", gradientMap: shirtGrad }),
      shirtLight: new THREE.MeshToonMaterial({ color: "#2b2d36", gradientMap: shirtGrad }),
      outline: new THREE.MeshBasicMaterial({ color: "#241410", side: THREE.BackSide }),
      hairOutline: new THREE.MeshBasicMaterial({ color: "#0a0710", side: THREE.BackSide }),
      line: new THREE.MeshBasicMaterial({ color: "#150c08", side: THREE.DoubleSide }),
      mouth: new THREE.MeshBasicMaterial({ color: "#6a3527", side: THREE.DoubleSide }),
      lip: new THREE.MeshBasicMaterial({ color: "#c98b68", side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
      nostril: new THREE.MeshBasicMaterial({ color: "#8a5133", side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
    };
  }, []);

  const geo = useMemo(() => {
    const lipUpper = lipShape(0.1, 0.022, 0.012);
    return {
      head: headGeometry(1),
      headOutline: headGeometry(1.028),
      cap: hairCap(1.1),
      capOutline: hairCap(1.138),
      locks: LOCKS.map(({ lock, shine }) => ({
        main: lockGeometry(lock),
        outline: lockGeometry(lock, 0.016),
        shine: shine ? lockGeometry(lock, -0.004, -0.4, 0.22, 0.02) : null,
      })),
      browL: decal(browShape(0.215, 0.1), -0.345, 0.335, 0.05, -0.1),
      browR: decal(browShape(0.215, 0.095), 0.345, 0.37, 0.05, 0.13, true),
      mustache: decal(mustacheShape(), 0, -0.385, 0.018),
      mouth: decal(lipShape(0.125, 0.034, 0), 0.005, -0.56, 0.014, 0.025),
      lowerLip: decal(lipShape(0.09, 0.045, 0), 0.0, -0.64, 0.012, 0),
      noseShadow: decal(lipShape(0.09, 0.035, 0), 0.0, -0.285, 0.01, 0),
      noseLine: new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([new THREE.Vector3(0.075, 0.14, zAt(0.075, 0.14) + 0.02), new THREE.Vector3(0.1, 0.0, zAt(0.1, 0.0) + 0.045), new THREE.Vector3(0.1, -0.12, zAt(0.1, -0.12) + 0.075)]),
        16, 0.011, 5),
      stubble: (() => {
        const g = headGeometry(1.012);
        return g;
      })(),
    };
  }, []);

  const stubbleTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 512;
    const x = c.getContext("2d")!;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26000; i++) {
      const u = rnd(), v = rnd();
      // v: 0 = chin, ~0.4 = cheek; denser toward the jaw and chin
      const vv = 0.5 * v;
      const dens = clamp(1 - Math.max(0, vv - 0.14) / 0.2, 0, 1);
      if (rnd() > dens) continue;
      x.fillStyle = `rgba(28,18,13,${0.35 + rnd() * 0.3})`;
      x.beginPath();
      x.arc(u * 1024, (1 - vv) * 512, 0.9 + rnd() * 0.9, 0, 7);
      x.fill();
    }
    // soft darker wash so it reads as shadow of stubble, not only dots
    const grad = x.createLinearGradient(0, 512, 0, 512 * 0.56);
    grad.addColorStop(0, "rgba(40,26,20,0.32)");
    grad.addColorStop(1, "rgba(40,26,20,0)");
    x.fillStyle = grad;
    x.fillRect(0, 512 * 0.56, 1024, 512 * 0.44);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);

  const blushTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, "rgba(232,120,100,0.3)");
    g.addColorStop(1, "rgba(232,120,100,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const mx = mouse.current.x, my = mouse.current.y;
    const h = head.current!, b = body.current!, hr = hair.current!;
    h.rotation.y = THREE.MathUtils.damp(h.rotation.y, mx * 0.42 + Math.sin(t * 0.5) * 0.03, 4, dt);
    h.rotation.x = THREE.MathUtils.damp(h.rotation.x, -my * 0.2 + 0.03, 4, dt);
    h.rotation.z = THREE.MathUtils.damp(h.rotation.z, -mx * 0.04 + 0.055 + Math.sin(t * 0.7) * 0.008, 3, dt);
    b.rotation.y = THREE.MathUtils.damp(b.rotation.y, mx * 0.1, 3, dt);
    b.scale.y = 1 + Math.sin(t * 1.6) * 0.006;
    hr.rotation.z = Math.sin(t * 0.9) * 0.008;
    hr.rotation.x = Math.sin(t * 0.7 + 1) * 0.006;

    // eyes track the cursor (a little ahead of the head), and blink every few seconds
    look.current.x = THREE.MathUtils.damp(look.current.x, mx, 9, dt);
    look.current.y = THREE.MathUtils.damp(look.current.y, my, 9, dt);
    if (t > nextBlink.current) nextBlink.current = t + 2.6 + Math.random() * 2.8;
    const since = t - (nextBlink.current - 0.16 - 0.0);
    // 0.16s blink window just before nextBlink
    look.current.blink = since > -0.16 && since < 0.0 ? Math.sin(((since + 0.16) / 0.16) * Math.PI) : 0;
  });

  return (
    <group position={[0, -0.25, 0]}>
      {/* ── body ── */}
      <group ref={body}>
        <mesh position={[0, -2.1, 0]} scale={[1.95, 1.05, 0.9]} material={m.shirt}>
          <sphereGeometry args={[1, 48, 36]} />
        </mesh>
        <mesh position={[0, -2.1, 0]} scale={[2.0, 1.09, 0.94]} material={m.outline}>
          <sphereGeometry args={[1, 40, 30]} />
        </mesh>
        {/* neck */}
        <mesh position={[0, -1.18, -0.02]} material={m.skinDark}>
          <cylinderGeometry args={[0.42, 0.5, 0.7, 32]} />
        </mesh>
        {/* collar flaps */}
        {([-1, 1] as const).map((s) => (
          <group key={s} position={[s * 0.4, -1.38, 0.44]} rotation={[0.5, s * -0.42, s * -0.72]}>
            <mesh material={m.shirtLight}>
              <boxGeometry args={[0.62, 0.07, 0.4]} />
            </mesh>
            <mesh material={m.outline} scale={[1.06, 1.5, 1.06]}>
              <boxGeometry args={[0.62, 0.07, 0.4]} />
            </mesh>
          </group>
        ))}
        {/* placket + buttons */}
        <mesh position={[0, -1.95, 0.88]} material={m.shirtLight}>
          <boxGeometry args={[0.07, 0.9, 0.03]} />
        </mesh>
        {[-1.72, -2.04, -2.36].map((y) => (
          <mesh key={y} position={[0, y, 0.9]}>
            <sphereGeometry args={[0.032, 12, 12]} />
            <meshBasicMaterial color="#8a8f9c" />
          </mesh>
        ))}
      </group>

      {/* ── head ── */}
      <group ref={head} position={[0, 0, 0]}>
        <mesh geometry={geo.head} material={m.skin} />
        <mesh geometry={geo.headOutline} material={m.outline} />

        {/* ears */}
        {([-1, 1] as const).map((s) => (
          <group key={s} position={[s * 0.84, -0.06, -0.06]} rotation-y={s * 0.25}>
            <mesh scale={[0.075, 0.2, 0.13]} material={m.skin}>
              <sphereGeometry args={[1, 24, 18]} />
            </mesh>
            <mesh position={[s * 0.02, -0.01, 0.045]} scale={[0.045, 0.13, 0.07]} material={m.skinDark}>
              <sphereGeometry args={[1, 18, 14]} />
            </mesh>
          </group>
        ))}

        {/* cheeks */}
        {([-1, 1] as const).map((s) => (
          <mesh key={s} position={[s * 0.45, -0.16, zAt(s * 0.45, -0.16) + 0.012]} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normalAt(s * 0.45, -0.16))}>
            <planeGeometry args={[0.34, 0.24]} />
            <meshBasicMaterial map={blushTex} transparent depthWrite={false} />
          </mesh>
        ))}

        {/* stubble over the jaw and chin */}
        <mesh geometry={geo.stubble}>
          <meshBasicMaterial map={stubbleTex} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
        </mesh>

        {/* nose */}
        <mesh position={[0, -0.2, zAt(0, -0.2) + 0.085]} scale={[0.135, 0.115, 0.115]} material={m.skin}>
          <sphereGeometry args={[1, 24, 18]} />
        </mesh>
        {([-1, 1] as const).map((s) => (
          <mesh key={s} position={[s * 0.075, -0.2, zAt(s * 0.075, -0.2) + 0.03]} scale={[0.058, 0.05, 0.05]} material={m.skin}>
            <sphereGeometry args={[1, 18, 14]} />
          </mesh>
        ))}
        <mesh geometry={geo.noseShadow} material={m.nostril} />
        <mesh geometry={geo.noseLine} material={m.nostril} />

        {/* brows, eyes */}
        <mesh geometry={geo.browL} material={m.line} />
        <mesh geometry={geo.browR} material={m.line} />
        <Eye side={-1} look={look} skin={m.skin} />
        <Eye side={1} look={look} skin={m.skin} />

        {/* mustache + mouth */}
        <mesh geometry={geo.mustache} material={m.line} />
        <mesh geometry={geo.lowerLip} material={m.lip} />
        <mesh geometry={geo.mouth} material={m.mouth} />

        {/* ── hair ── */}
        <group ref={hair}>
          <mesh geometry={geo.cap} material={m.hair} />
          <mesh geometry={geo.capOutline} material={m.hairOutline} />
          {geo.locks.map((l, i) => (
            <group key={i}>
              <mesh geometry={l.outline} material={m.hairOutline} />
              <mesh geometry={l.main} material={m.hair} />
              {l.shine && <mesh geometry={l.shine} material={m.shine} />}
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

/** soft painted sky behind the character, with a few slow clouds */
function Sky() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 768;
    const x = c.getContext("2d")!;
    const g = x.createLinearGradient(0, 0, 0, 768);
    g.addColorStop(0, "#5f9fd1");
    g.addColorStop(0.55, "#a9d2e8");
    g.addColorStop(1, "#f6e6c4");
    x.fillStyle = g;
    x.fillRect(0, 0, 1024, 768);
    const puff = (cx: number, cy: number, r: number, a: number) => {
      const rg = x.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
      rg.addColorStop(0, `rgba(255,255,255,${a})`);
      rg.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = rg;
      x.beginPath();
      x.arc(cx, cy, r, 0, 7);
      x.fill();
    };
    // cumulus clouds built from overlapping puffs
    const cloud = (cx: number, cy: number, s: number) => {
      [[0, 0, 70], [-70, 18, 54], [68, 20, 58], [-20, -26, 56], [34, -22, 50], [-120, 34, 40], [118, 36, 42]].forEach(([dx, dy, r]) => puff(cx + dx * s, cy + dy * s, r * s, 0.95));
    };
    cloud(250, 190, 1.25);
    cloud(760, 130, 0.95);
    cloud(860, 420, 1.1);
    cloud(110, 470, 0.85);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={[0, 0, -5]}>
      <planeGeometry args={[15, 11.3]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

export default function GhibliAvatar() {
  return (
    <div className="ali-3d-wrapper">
      <Canvas camera={{ position: [0, -0.5, 6.7], fov: 31 }} dpr={[1, 2]} flat gl={{ antialias: true }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[-2.5, 3.5, 5]} intensity={2.2} color="#fff4e0" />
        <directionalLight position={[4, 0.5, 2]} intensity={0.6} color="#bcd4ff" />
        <Sky />
        <Character />
      </Canvas>
    </div>
  );
}
