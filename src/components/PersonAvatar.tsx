import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * A Pixar-style 3D head of Muhammad Ali, built procedurally: soft subsurface-style skin, big real
 * 3D eyeballs (dark brown irises, glossy corneas) inside eyelids that follow the cursor and blink,
 * thick brows, a neat mustache with stubble, and a tall, glossy, side-swept black quiff with a
 * fringe over the right eye, shaded with an anisotropic hair shader. Floats on black.
 */

const V3 = THREE.Vector3;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = THREE.MathUtils.lerp;
const D2R = Math.PI / 180;

// ── head shape, measured from the photo: long face, wide cheekbones, strong chin ─────────────
// [height y, half-width, half-depth, cross-section exponent (higher = squarer, stronger jaw)]
const KN: [number, number, number, number][] = [
  [1.0, 0.0, 0.0, 2.0],
  [0.95, 0.3, 0.26, 2.0],
  [0.85, 0.6, 0.54, 2.0],
  [0.62, 0.8, 0.72, 2.1],
  [0.3, 0.88, 0.8, 2.2],
  [0.05, 0.9, 0.82, 2.3],
  [-0.2, 0.85, 0.8, 2.4],
  [-0.5, 0.67, 0.73, 2.55],
  [-0.75, 0.46, 0.6, 2.4],
  [-0.92, 0.28, 0.46, 2.2],
  [-0.97, 0.14, 0.3, 2.1],
  [-1.0, 0.0, 0.0, 2.0],
];
const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

function prof(y: number): [number, number, number] {
  if (y >= KN[0][0]) return [KN[0][1], KN[0][2], KN[0][3]];
  for (let i = 0; i < KN.length - 1; i++) {
    const a = KN[i], b = KN[i + 1];
    if (y <= a[0] && y >= b[0]) {
      const t = (a[0] - y) / (a[0] - b[0]);
      const p0 = KN[Math.max(i - 1, 0)], p3 = KN[Math.min(i + 2, KN.length - 1)];
      const h = (k: number) => catmull(p0[k], a[k], b[k], p3[k], t);
      return [h(1), h(2), h(3)];
    }
  }
  const l = KN[KN.length - 1];
  return [l[1], l[2], l[3]];
}

/** point on the head surface at height y and azimuth ang (radians; 0 = front, + = the viewer's right) */
function headP(y: number, ang: number) {
  const [W, D, p] = prof(y);
  const dx = Math.sin(ang), dz = Math.cos(ang);
  const s = Math.pow(Math.pow(Math.abs(dx), p) + Math.pow(Math.abs(dz), p), -1 / p);
  const chin = y < -0.5 ? (-0.5 - y) * 0.16 * Math.max(dz, 0) : 0;
  return new V3(dx * s * W, y, dz * s * D * (dz < 0 ? 0.92 : 1) + chin);
}

function headFrame(y: number, ang: number, off = 0) {
  const e = 0.012;
  const p = headP(y, ang);
  const dy = headP(Math.min(y + e, 0.999), ang).sub(headP(Math.max(y - e, -0.999), ang));
  const da = headP(y, ang + e).sub(headP(y, ang - e));
  const n = new V3().crossVectors(da, dy);
  if (n.lengthSq() < 1e-10) n.set(0, y > 0 ? 1 : -1, 0);
  n.normalize();
  if (n.dot(p) < 0) n.negate();
  return { p, n, pos: p.clone().addScaledVector(n, off), dy, da };
}

function makeHeadGeometry() {
  const g = new THREE.SphereGeometry(1, 96, 72);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = headP(p.getY(i), Math.atan2(p.getX(i), p.getZ(i)));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** height map of the face so features can be laid onto the surface */
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
    const dir = new V3(0, 0, -1);
    this.z = new Float32Array(this.N * this.N);
    for (let j = 0; j < this.N; j++)
      for (let i = 0; i < this.N; i++) {
        const x = this.x0 + ((this.x1 - this.x0) * i) / (this.N - 1);
        const y = this.y0 + ((this.y1 - this.y0) * j) / (this.N - 1);
        rc.set(new V3(x, y, 3), dir);
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
    return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
  }
  normalAt(x: number, y: number) {
    const h = 0.02;
    const dzdx = (this.zAt(x + h, y) - this.zAt(x - h, y)) / (2 * h);
    const dzdy = (this.zAt(x, y + h) - this.zAt(x, y - h)) / (2 * h);
    return new V3(-dzdx, -dzdy, 1).normalize();
  }
  point(x: number, y: number, off = 0) {
    return new V3(x, y, this.zAt(x, y)).addScaledVector(this.normalAt(x, y), off);
  }
  quat(x: number, y: number) {
    return new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), this.normalAt(x, y));
  }
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

// ── skin: soft, warm, subsurface-style shading ──────────────────────────────────────────────
const SKIN_VERT = /* glsl */ `
uniform mat4 uHeadInv;
varying vec3 vN;
varying vec3 vW;
varying vec3 vP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vP = (uHeadInv * wp).xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const SKIN_FRAG = /* glsl */ `
uniform vec3 uLit;
uniform vec3 uShadow;
uniform vec3 uSSS;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uFillDir;
uniform vec3 uFillCol;
uniform vec3 uRimDir;
uniform vec3 uRimCol;
varying vec3 vN;
varying vec3 vW;
varying vec3 vP;
void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vW);
  vec3 L = normalize(uKeyDir);
  float ndl = dot(N, L);
  float wrap = clamp((ndl + 0.5) / 1.5, 0.0, 1.0);
  vec3 base = mix(uShadow, uLit, smoothstep(0.08, 0.9, wrap));
  // facial colouring (head space): warm cheeks, nose tip, ears
  vec3 p = vP;
  float front = smoothstep(-0.2, 0.5, p.z);
  float cheek = smoothstep(0.36, 0.0, length(vec2(abs(p.x) - 0.52, p.y + 0.14))) * front;
  float nose = smoothstep(0.17, 0.0, length(vec2(p.x, p.y + 0.2))) * front;
  float ear = smoothstep(0.86, 1.0, abs(p.x));
  base = mix(base, uSSS, 0.22 * cheek + 0.28 * nose + 0.25 * ear);
  // light scattering through thin skin near the shadow edge
  float sss = exp(-pow((ndl - 0.08) * 3.0, 2.0));
  vec3 col = base * uKeyCol * 0.95 + uSSS * sss * 0.2;
  col += base * uFillCol * max(dot(N, normalize(uFillDir)) * 0.5 + 0.5, 0.0) * 0.28;
  vec3 H = normalize(L + V);
  float nh = max(dot(N, H), 0.0);
  col += uKeyCol * (pow(nh, 50.0) * 0.3 + pow(nh, 10.0) * 0.05) * smoothstep(0.0, 0.3, ndl);
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += uRimCol * fr * clamp(dot(N, normalize(uRimDir)) * 0.5 + 0.5, 0.0, 1.0) * 0.5;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// ── hair ─────────────────────────────────────────────────────────────────────────────────────
type Clump = { pts: [number, number, number][]; w0: number; w1: number; th: number; ellipsoid?: boolean };

// ellipsoid point (for the tall quiff above the head): latitude, longitude (deg), radius
const EP = (lat: number, lon: number, rad: number) => {
  const la = lat * D2R, lo = lon * D2R;
  return new V3(rad * 0.92 * Math.cos(la) * Math.sin(lo), rad * 1.0 * Math.sin(la), rad * 0.85 * Math.cos(la) * Math.cos(lo));
};

const CLUMPS: Clump[] = [
  // the quiff: rises off the front hairline, over the top and sweeps to the right
  { ellipsoid: true, pts: [[46, -4, 1.1], [62, 2, 1.26], [76, 12, 1.4], [82, 36, 1.38], [72, 60, 1.28], [54, 78, 1.14]], w0: 0.42, w1: 0.03, th: 0.12 },
  { ellipsoid: true, pts: [[44, -26, 1.1], [60, -20, 1.27], [76, -6, 1.42], [84, 20, 1.4], [76, 46, 1.28], [58, 66, 1.14]], w0: 0.4, w1: 0.03, th: 0.12 },
  { ellipsoid: true, pts: [[42, -48, 1.1], [58, -44, 1.24], [74, -32, 1.38], [84, -8, 1.4], [80, 24, 1.3], [64, 48, 1.16]], w0: 0.38, w1: 0.03, th: 0.11 },
  { ellipsoid: true, pts: [[40, -68, 1.08], [54, -64, 1.2], [70, -54, 1.3], [82, -34, 1.34], [84, -6, 1.3]], w0: 0.36, w1: 0.04, th: 0.1 },
  { ellipsoid: true, pts: [[50, 30, 1.1], [66, 36, 1.24], [78, 52, 1.28], [70, 78, 1.18], [52, 92, 1.1]], w0: 0.34, w1: 0.04, th: 0.095 },
  // the fringe falling across the forehead, over the right brow and the top of the right eye
  { pts: [[0.98, -45, 0.22], [0.92, -14, 0.32], [0.8, 14, 0.3], [0.62, 30, 0.22], [0.44, 38, 0.14], [0.3, 42, 0.09]], w0: 0.3, w1: 0.02, th: 0.085 },
  { pts: [[0.94, -25, 0.24], [0.86, 0, 0.32], [0.72, 20, 0.28], [0.54, 30, 0.2], [0.38, 36, 0.12], [0.24, 40, 0.07]], w0: 0.26, w1: 0.02, th: 0.08 },
  { pts: [[0.9, -60, 0.22], [0.86, -34, 0.3], [0.76, -10, 0.28], [0.62, 10, 0.22], [0.5, 22, 0.16]], w0: 0.26, w1: 0.03, th: 0.075 },
  // sides over the tops of the ears, and the back
  { pts: [[0.8, -78, 0.16], [0.6, -90, 0.16], [0.35, -98, 0.14], [0.1, -102, 0.11], [-0.14, -104, 0.08]], w0: 0.3, w1: 0.04, th: 0.08 },
  { pts: [[0.8, 78, 0.16], [0.6, 90, 0.16], [0.35, 98, 0.14], [0.1, 102, 0.11], [-0.14, 104, 0.08]], w0: 0.3, w1: 0.04, th: 0.08 },
  { pts: [[0.8, 150, 0.16], [0.5, 160, 0.15], [0.1, 170, 0.11], [-0.3, 178, 0.08]], w0: 0.32, w1: 0.05, th: 0.085 },
  { pts: [[0.8, -150, 0.16], [0.5, -160, 0.15], [0.1, -170, 0.11], [-0.3, -178, 0.08]], w0: 0.32, w1: 0.05, th: 0.085 },
];

const clumpCtrl = (c: Clump) =>
  c.ellipsoid ? c.pts.map(([la, lo, r]) => EP(la, lo, r)) : c.pts.map(([y, a, off]) => headFrame(y, a * D2R, off * (1 + 0.3 * THREE.MathUtils.smoothstep(y, 0.4, 0.95))).pos);

/** a tapering ribbon-like tube of hair along a curve */
function strand(ctrl: THREE.Vector3[], w0: number, w1: number, th: number, ao: number, N = 30, M = 10) {
  const curve = new THREE.CatmullRomCurve3(ctrl);
  const pts = curve.getPoints(N);
  const pos: number[] = [], nrm: number[] = [], tn: number[] = [], aoA: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = pts[i];
    const tan = curve.getTangent(t).normalize();
    const out = new V3(p.x, p.y * 0.75, p.z).normalize();
    let wd = new V3().crossVectors(tan, out);
    if (wd.lengthSq() < 1e-8) wd = new V3(1, 0, 0);
    wd.normalize();
    const o2 = new V3().crossVectors(wd, tan).normalize();
    if (o2.dot(out) < 0) o2.negate();
    const w = lerp(w0, w1, Math.pow(t, 0.8));
    const h = th * (1 - 0.55 * t);
    for (let k = 0; k < M; k++) {
      const a = (Math.PI * 2 * k) / M;
      const c = Math.cos(a), s = Math.sin(a);
      const v = p.clone().addScaledVector(wd, c * w).addScaledVector(o2, s * h);
      const n = wd.clone().multiplyScalar(c / Math.max(w, 1e-4)).addScaledVector(o2, s / Math.max(h, 1e-4)).normalize();
      pos.push(v.x, v.y, v.z);
      nrm.push(n.x, n.y, n.z);
      tn.push(tan.x, tan.y, tan.z);
      aoA.push(ao);
    }
  }
  for (let i = 0; i < N; i++)
    for (let k = 0; k < M; k++) {
      const a = i * M + k, b = i * M + ((k + 1) % M), c = (i + 1) * M + k, d = (i + 1) * M + ((k + 1) % M);
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("strandTan", new THREE.Float32BufferAttribute(tn, 3));
  g.setAttribute("ao", new THREE.Float32BufferAttribute(aoA, 1));
  g.setIndex(idx);
  return g;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** the scalp shell that gives the hair its mass (thick on top, hairline across the forehead) */
function scalpShell() {
  const cols = 120, rows = 40;
  const table: [number, number][] = [[0, 0.62], [35, 0.58], [60, 0.4], [82, 0.14], [100, -0.04], [135, -0.3], [180, -0.5]];
  const hairline = (a: number) => {
    const d = Math.abs(a) / D2R;
    for (let i = 0; i < table.length - 1; i++) {
      const [a0, b0] = table[i], [a1, b1] = table[i + 1];
      if (d <= a1) return lerp(b0, b1, (d - a0) / (a1 - a0));
    }
    return table[table.length - 1][1];
  };
  const pos: number[] = [], nrm: number[] = [], tn: number[] = [], aoA: number[] = [], idx: number[] = [];
  for (let j = 0; j <= cols; j++) {
    const ang = -Math.PI + (2 * Math.PI * j) / cols;
    const yb = hairline(ang);
    for (let i = 0; i <= rows; i++) {
      const y = lerp(0.995, yb, i / rows);
      const thick = 0.1 + 0.22 * Math.max(0, y - 0.3) + 0.2 * Math.exp(-(((ang - 0.2) / 0.8) ** 2)) * THREE.MathUtils.smoothstep(y, 0.45, 0.95);
      const f = headFrame(y, ang, thick);
      pos.push(f.pos.x, f.pos.y, f.pos.z);
      nrm.push(f.n.x, f.n.y, f.n.z);
      const flow = f.dy.clone().multiplyScalar(-1).normalize().addScaledVector(f.da.clone().normalize(), 0.6).normalize();
      tn.push(flow.x, flow.y, flow.z);
      aoA.push(0.4);
    }
  }
  for (let j = 0; j < cols; j++)
    for (let i = 0; i < rows; i++) {
      const a = j * (rows + 1) + i, b = a + 1, c = (j + 1) * (rows + 1) + i, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("strandTan", new THREE.Float32BufferAttribute(tn, 3));
  g.setAttribute("ao", new THREE.Float32BufferAttribute(aoA, 1));
  g.setIndex(idx);
  return g;
}

function buildHair() {
  const parts: THREE.BufferGeometry[] = [scalpShell()];
  CLUMPS.forEach((c) => parts.push(strand(clumpCtrl(c), c.w0, c.w1, c.th, 1)));
  const r = rng(21);
  // wisps curling off the top of the quiff
  for (let i = 0; i < 16; i++) {
    const lon = -50 + r() * 100;
    const lat = 74 + r() * 8;
    const pts = [EP(lat, lon, 1.34), EP(lat + 3, lon + 6, 1.46 + r() * 0.1), EP(lat - 2, lon + 16 + r() * 10, 1.52 + r() * 0.12), EP(lat - 12, lon + 26 + r() * 10, 1.5)];
    parts.push(strand(pts, 0.012, 0.002, 0.012, 1, 16, 5));
  }
  // a few fine flyaways along the fringe
  for (let i = 0; i < 40; i++) {
    const c = CLUMPS[5 + Math.floor(r() * 3)];
    const k = Math.floor(r() * (c.pts.length - 3));
    const pts = c.pts.slice(k).map(([y, a, off]): [number, number, number] => [y + (r() - 0.5) * 0.06, a + (r() - 0.5) * 6, off + 0.02 + r() * 0.04]);
    parts.push(strand(pts.map(([y, a, off]) => headFrame(clamp(y, -0.9, 0.995), a * D2R, off).pos), 0.01, 0.002, 0.009, 1, 14, 5));
  }
  return mergeGeometries(parts, false)!;
}

const HAIR_VERT = /* glsl */ `
attribute vec3 strandTan;
attribute float ao;
varying vec3 vN;
varying vec3 vT;
varying vec3 vW;
varying float vAO;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vT = normalize(mat3(modelMatrix) * strandTan);
  vAO = ao;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

// Kajiya-Kay style anisotropic highlights: bright bands running along the clumps
const HAIR_FRAG = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uRimDir;
uniform vec3 uRimCol;
uniform vec3 uSpec1;
uniform vec3 uSpec2;
varying vec3 vN;
varying vec3 vT;
varying vec3 vW;
varying float vAO;
void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 T = normalize(vT);
  vec3 V = normalize(cameraPosition - vW);
  vec3 L = normalize(uKeyDir);
  vec3 R = normalize(uRimDir);
  float diff = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);
  diff *= diff;
  vec3 H = normalize(L + V);
  vec3 T1 = normalize(T + N * 0.1);
  vec3 T2 = normalize(T - N * 0.3);
  float d1 = dot(T1, H);
  float d2 = dot(T2, H);
  float s1 = pow(sqrt(max(0.0, 1.0 - d1 * d1)), 140.0);
  float s2 = pow(sqrt(max(0.0, 1.0 - d2 * d2)), 22.0);
  float ndl = smoothstep(-0.05, 0.4, dot(N, L));
  vec3 col = uBase * (0.2 + 0.8 * diff) * uKeyCol * vAO;
  col += uSpec1 * s1 * ndl * 1.5 + uSpec2 * s2 * ndl * 0.012;
  float fr = pow(1.0 - max(dot(N, V), 0.0), 2.2);
  col += uRimCol * fr * clamp(dot(N, R) * 0.5 + 0.5, 0.0, 1.0) * 0.045;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// ── textures ─────────────────────────────────────────────────────────────────────────────────
function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const irisTexture = () =>
  canvasTex(256, 256, (x) => {
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 126);
    g.addColorStop(0, "#000");
    g.addColorStop(0.3, "#000");
    g.addColorStop(0.33, "#7d4a22");
    g.addColorStop(0.52, "#4f2b13");
    g.addColorStop(0.84, "#27140a");
    g.addColorStop(1, "#0e0703");
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    let s = 3;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 120; i++) {
      const a = r() * Math.PI * 2;
      x.strokeStyle = `rgba(210,140,76,${0.1 + r() * 0.22})`;
      x.lineWidth = 1 + r() * 1.2;
      x.beginPath();
      x.moveTo(128 + Math.cos(a) * 42, 128 + Math.sin(a) * 42);
      x.lineTo(128 + Math.cos(a) * (84 + r() * 36), 128 + Math.sin(a) * (84 + r() * 36));
      x.stroke();
    }
    x.strokeStyle = "rgba(0,0,0,0.8)";
    x.lineWidth = 12;
    x.beginPath();
    x.arc(128, 128, 124, 0, 7);
    x.stroke();
  });

const hairStrokeTexture = () =>
  canvasTex(128, 128, (x) => {
    x.fillStyle = "#090605";
    x.fillRect(0, 0, 128, 128);
    let s = 9;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 520; i++) {
      x.strokeStyle = `rgba(${40 + r() * 50},${26 + r() * 34},${18 + r() * 24},${0.25 + r() * 0.5})`;
      x.lineWidth = 0.6 + r();
      const px = r() * 128, py = r() * 128;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + 6 + r() * 12, py + (r() - 0.5) * 6);
      x.stroke();
    }
  });

const stubbleTexture = () =>
  canvasTex(1024, 512, (x) => {
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 38000; i++) {
      const u = r(), v = r();
      const vv = 0.46 * v;
      const dens = clamp(1 - Math.max(0, vv - 0.18) / 0.22, 0, 1);
      if (r() > dens) continue;
      x.fillStyle = `rgba(24,15,11,${0.28 + r() * 0.32})`;
      x.beginPath();
      x.arc(u * 1024, (1 - vv) * 512, 0.8 + r() * 0.9, 0, 7);
      x.fill();
    }
    const wash = x.createLinearGradient(0, 512, 0, 512 * 0.56);
    wash.addColorStop(0, "rgba(40,26,20,0.28)");
    wash.addColorStop(1, "rgba(40,26,20,0)");
    x.fillStyle = wash;
    x.fillRect(0, 512 * 0.56, 1024, 512 * 0.44);
  });

// ── face features ────────────────────────────────────────────────────────────────────────────
function browGeometry(s: Surface, side: -1 | 1) {
  const raised = side === 1; // viewer-right brow (his left) is raised with a soft arch
  const w = 0.24, thIn = raised ? 0.105 : 0.12, thOut = 0.055, arch = raised ? 0.055 : 0.025;
  const sh = new THREE.Shape();
  sh.moveTo(-w, thIn * 0.4);
  sh.bezierCurveTo(-w * 0.4, thIn * 0.4 + arch, w * 0.4, thOut * 0.3 + arch * 1.1, w, 0);
  sh.lineTo(w, -thOut * 0.3);
  sh.bezierCurveTo(w * 0.4, -thOut * 0.55 + arch * 0.6, -w * 0.4, -thIn * 0.6 + arch * 0.5, -w, -thIn * 0.6);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: true, bevelSize: 0.014, bevelThickness: 0.018, bevelSegments: 3, curveSegments: 22 });
  const p = g.attributes.position;
  const slope = raised ? 0.18 : -0.1;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) * (side === -1 ? -1 : 1);
    const y = p.getY(i) + x * (side === -1 ? -slope : slope) * -0.5;
    p.setXYZ(i, x, y, p.getZ(i));
  }
  return s.conform(g, side * 0.42, raised ? 0.4 : 0.37, 0.012);
}

function mustacheGeometry(s: Surface) {
  const sh = new THREE.Shape();
  sh.moveTo(-0.3, -0.05);
  sh.bezierCurveTo(-0.3, 0.03, -0.15, 0.062, 0, 0.036);
  sh.bezierCurveTo(0.15, 0.062, 0.3, 0.03, 0.3, -0.05);
  sh.bezierCurveTo(0.22, -0.022, 0.1, -0.03, 0, -0.013);
  sh.bezierCurveTo(-0.1, -0.03, -0.22, -0.022, -0.3, -0.05);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.014, bevelSegments: 3, curveSegments: 28 });
  return s.conform(g, 0, -0.43, 0.014);
}

function lipGeometries(s: Surface) {
  const up = new THREE.Shape();
  up.moveTo(-0.25, 0);
  up.bezierCurveTo(-0.15, 0.03, -0.05, 0.048, 0, 0.03);
  up.bezierCurveTo(0.05, 0.048, 0.15, 0.03, 0.25, 0);
  up.bezierCurveTo(0.12, -0.012, -0.12, -0.012, -0.25, 0);
  const lo = new THREE.Shape();
  lo.moveTo(-0.22, 0);
  lo.bezierCurveTo(-0.12, -0.08, 0.12, -0.08, 0.22, 0);
  lo.bezierCurveTo(0.12, 0.012, -0.12, 0.012, -0.22, 0);
  const ex = { depth: 0.012, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.01, bevelSegments: 3, curveSegments: 24 };
  const my = -0.55;
  const line = new THREE.Shape();
  line.moveTo(-0.255, 0);
  line.bezierCurveTo(-0.1, -0.013, 0.1, -0.013, 0.255, 0.008);
  line.lineTo(0.255, 0.0);
  line.bezierCurveTo(0.1, -0.024, -0.1, -0.024, -0.255, -0.008);
  line.closePath();
  return {
    upper: s.conform(new THREE.ExtrudeGeometry(up, ex), 0, my, 0.012),
    lower: s.conform(new THREE.ExtrudeGeometry(lo, ex), 0, my, 0.012),
    line: s.conform(new THREE.ShapeGeometry(line, 16), 0, my, 0.02),
  };
}

type Look = { x: number; y: number; hx: number; blink: number };

/** a spherical cap whose UVs are projected flat, so a round texture sits on it like an iris */
function irisCap(R: number, ang: number) {
  const g = new THREE.SphereGeometry(R, 56, 28, 0, Math.PI * 2, 0, ang);
  const p = g.attributes.position, uv = g.attributes.uv;
  const rr = R * Math.sin(ang);
  for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (2 * rr), 0.5 + p.getZ(i) / (2 * rr));
  return g;
}

const EYE_R = 0.205;

/** a real 3D eyeball (sclera, dark-brown iris, glossy cornea) set between upper and lower eyelids */
function Eye({ side, look, surf, skin, irisTex }: { side: -1 | 1; look: React.MutableRefObject<Look>; surf: Surface; skin: THREE.Material; irisTex: THREE.Texture }) {
  const ball = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const lower = useRef<THREE.Group>(null);
  const cx = side * 0.42, cy = 0.1;
  const depth = 0.165;
  const pos = useMemo(() => surf.point(cx, cy, -depth), [surf, cx]);
  const quat = useMemo(() => surf.quat(cx, cy), [surf, cx]);
  const geo = useMemo(() => {
    const sclera = new THREE.SphereGeometry(EYE_R, 56, 40);
    const col: number[] = [];
    const p = sclera.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const sh = THREE.MathUtils.smoothstep(p.getY(i) / EYE_R, 0.1, 0.95); // shadow under the upper lid
      col.push(1 - 0.38 * sh, 1 - 0.42 * sh, 1 - 0.42 * sh);
    }
    sclera.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return {
      sclera,
      iris: irisCap(EYE_R * 1.002, 0.56),
      cornea: new THREE.SphereGeometry(EYE_R * 1.022, 48, 28, 0, Math.PI * 2, 0, 0.9),
      upper: new THREE.SphereGeometry(EYE_R * 1.07, 56, 32, 0, Math.PI * 2, 0, 1.5),
      lower: new THREE.SphereGeometry(EYE_R * 1.07, 56, 32, 0, Math.PI * 2, Math.PI - 1.0, 1.0),
    };
  }, []);
  const ballMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#f3ede6", vertexColors: true, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2 }), []);
  const irisMat = useMemo(() => new THREE.MeshStandardMaterial({ map: irisTex, roughness: 0.35 }), [irisTex]);
  const corneaMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.1, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false }), []);

  useFrame(() => {
    const l = look.current;
    if (ball.current) {
      ball.current.rotation.y = THREE.MathUtils.damp(ball.current.rotation.y, clamp(l.x * 0.55 - l.hx * 0.5, -0.5, 0.5), 14, 1 / 60);
      ball.current.rotation.x = THREE.MathUtils.damp(ball.current.rotation.x, clamp(-l.y * 0.4, -0.35, 0.35), 14, 1 / 60);
    }
    if (upper.current) upper.current.rotation.x = -0.3 + l.blink * 1.35;
    if (lower.current) lower.current.rotation.x = -0.25 + l.blink * 0.55;
  });

  const catch1 = useMemo(() => {
    const x = 0.075, y = 0.085;
    return [x, y, Math.sqrt(Math.max(0, (EYE_R * 1.03) ** 2 - x * x - y * y))] as [number, number, number];
  }, []);
  const catch2 = useMemo(() => {
    const x = -0.06, y = -0.06;
    return [x, y, Math.sqrt(Math.max(0, (EYE_R * 1.03) ** 2 - x * x - y * y))] as [number, number, number];
  }, []);

  return (
    <group position={pos} quaternion={quat}>
      <group ref={ball}>
        <mesh geometry={geo.sclera} material={ballMat} />
        <group rotation-x={Math.PI / 2}>
          <mesh geometry={geo.iris} material={irisMat} />
          <mesh geometry={geo.cornea} material={corneaMat} />
        </group>
      </group>
      {/* catchlights stay put while the eye turns */}
      <mesh position={catch1}>
        <circleGeometry args={[0.03, 24]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={catch2}>
        <circleGeometry args={[0.013, 20]} />
        <meshBasicMaterial color="#f6ece2" />
      </mesh>
      {/* eyelids: arched caps, closing on a blink */}
      <group ref={upper} rotation-x={-0.3}>
        <mesh geometry={geo.upper} material={skin} />
      </group>
      <group ref={lower} rotation-x={-0.25}>
        <mesh geometry={geo.lower} material={skin} />
      </group>
    </group>
  );
}

function Character() {
  const head = useRef<THREE.Group>(null);
  const hairG = useRef<THREE.Group>(null);
  const look = useRef<Look>({ x: 0, y: 0, hx: 0, blink: 0 });
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

  const tex = useMemo(() => {
    const hair = hairStrokeTexture();
    hair.wrapS = hair.wrapT = THREE.RepeatWrapping;
    hair.repeat.set(4, 8);
    return { iris: irisTexture(), hair, stubble: stubbleTexture() };
  }, []);

  const headInv = useMemo(() => new THREE.Matrix4(), []);
  const mats = useMemo(() => {
    const skinUniforms = {
      uHeadInv: { value: headInv },
      uLit: { value: new THREE.Color("#d9a47a") },
      uShadow: { value: new THREE.Color("#7c3b2a") },
      uSSS: { value: new THREE.Color("#e2603c") },
      uKeyDir: { value: new V3(-0.5, 0.7, 0.9) },
      uKeyCol: { value: new THREE.Color("#fff1e4") },
      uFillDir: { value: new V3(0.8, 0.1, 0.6) },
      uFillCol: { value: new THREE.Color("#ffd6c0") },
      uRimDir: { value: new V3(0.7, 0.5, -0.8) },
      uRimCol: { value: new THREE.Color("#9fdcff") },
    };
    return {
      skin: new THREE.ShaderMaterial({ vertexShader: SKIN_VERT, fragmentShader: SKIN_FRAG, uniforms: skinUniforms, side: THREE.DoubleSide }),
      earIn: new THREE.MeshStandardMaterial({ color: "#8a4a33", roughness: 0.7 }),
      browHair: new THREE.MeshStandardMaterial({ color: "#150e0b", map: tex.hair, roughness: 0.75, side: THREE.DoubleSide }),
      lip: new THREE.MeshStandardMaterial({ color: "#a05c49", roughness: 0.5 }),
      lipLine: new THREE.MeshBasicMaterial({ color: "#3a1812" }),
      nostril: new THREE.MeshBasicMaterial({ color: "#5d2f1f" }),
      hair: new THREE.ShaderMaterial({
        vertexShader: HAIR_VERT,
        fragmentShader: HAIR_FRAG,
        side: THREE.DoubleSide,
        uniforms: {
          uBase: { value: new THREE.Color("#040406") },
          uKeyDir: { value: new V3(-0.4, 0.8, 0.9) },
          uKeyCol: { value: new THREE.Color("#fff6ee") },
          uRimDir: { value: new V3(0.6, 0.4, -0.7) },
          uRimCol: { value: new THREE.Color("#8fb8ff") },
          uSpec1: { value: new THREE.Color("#f4f7ff") },
          uSpec2: { value: new THREE.Color("#7a86a6") },
        },
      }),
    };
  }, [tex, headInv]);

  const hairGeo = useMemo(() => buildHair(), []);
  const geo = useMemo(() => ({ brow: [browGeometry(surf, -1), browGeometry(surf, 1)], mustache: mustacheGeometry(surf), ...lipGeometries(surf) }), [surf]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const mx = mouse.current.x, my = mouse.current.y;
    const h = head.current!, hg = hairG.current!;
    h.rotation.y = THREE.MathUtils.damp(h.rotation.y, mx * 0.42 + Math.sin(t * 0.5) * 0.03, 4, dt);
    h.rotation.x = THREE.MathUtils.damp(h.rotation.x, -my * 0.2, 4, dt);
    h.rotation.z = THREE.MathUtils.damp(h.rotation.z, -mx * 0.03 + Math.sin(t * 0.7) * 0.012, 4, dt);
    h.position.y = Math.sin(t * 1.1) * 0.015;
    hg.rotation.z = Math.sin(t * 0.9) * 0.006;
    h.updateMatrixWorld(true);
    headInv.copy(h.matrixWorld).invert();
    look.current.x = THREE.MathUtils.damp(look.current.x, mx, 9, dt);
    look.current.y = THREE.MathUtils.damp(look.current.y, my, 9, dt);
    look.current.hx = h.rotation.y;
    if (t > nextBlink.current) nextBlink.current = t + 2.6 + Math.random() * 2.8;
    const since = t - (nextBlink.current - 0.16);
    look.current.blink = since > 0 && since < 0.16 ? Math.sin((since / 0.16) * Math.PI) : 0;
  });

  const noseTip = useMemo(() => surf.point(0, -0.2, 0.075), [surf]);

  return (
    <group position={[0, -0.22, 0]}>
      <group ref={head}>
        <mesh geometry={headGeo} material={mats.skin} />
        {/* stubble over the jaw and chin */}
        <mesh geometry={headGeo} scale={1.006}>
          <meshBasicMaterial map={tex.stubble} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
        </mesh>

        {/* big ears */}
        {([-1, 1] as const).map((s) => (
          <group key={s} position={[s * 0.9, -0.03, -0.1]} rotation-y={s * 0.32}>
            <mesh scale={[0.11, 0.27, 0.2]} material={mats.skin}>
              <sphereGeometry args={[1, 32, 24]} />
            </mesh>
            <mesh position={[s * 0.03, -0.01, 0.06]} scale={[0.06, 0.17, 0.11]} material={mats.earIn}>
              <sphereGeometry args={[1, 22, 18]} />
            </mesh>
          </group>
        ))}

        <mesh geometry={geo.brow[0]} material={mats.browHair} />
        <mesh geometry={geo.brow[1]} material={mats.browHair} />
        <Eye side={-1} look={look} surf={surf} skin={mats.skin} irisTex={tex.iris} />
        <Eye side={1} look={look} surf={surf} skin={mats.skin} irisTex={tex.iris} />

        {/* nose: soft tip and wings */}
        <mesh position={noseTip} scale={[0.1, 0.085, 0.09]} material={mats.skin}>
          <sphereGeometry args={[1, 32, 24]} />
        </mesh>
        {([-1, 1] as const).map((s) => (
          <group key={s}>
            <mesh position={surf.point(s * 0.09, -0.22, 0.035)} scale={[0.055, 0.05, 0.045]} material={mats.skin}>
              <sphereGeometry args={[1, 20, 16]} />
            </mesh>
            <mesh position={surf.point(s * 0.045, -0.265, 0.07)} scale={[0.028, 0.012, 0.02]} material={mats.nostril}>
              <sphereGeometry args={[1, 12, 10]} />
            </mesh>
          </group>
        ))}

        <mesh geometry={geo.line} material={mats.lipLine} />
        <mesh geometry={geo.upper} material={mats.lip} />
        <mesh geometry={geo.lower} material={mats.lip} />
        <mesh geometry={geo.mustache} material={mats.browHair} />

        <group ref={hairG}>
          <mesh geometry={hairGeo} material={mats.hair} />
        </group>
      </group>
    </group>
  );
}

export default function PersonAvatar() {
  return (
    <div className="ali-3d-wrapper">
      <Canvas camera={{ position: [0, 0.15, 6.3], fov: 31 }} dpr={[1, 2]} gl={{ antialias: true }}>
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[-2.5, 3.5, 5]} intensity={2.4} color="#fff1e4" />
        <directionalLight position={[4, 0.5, 3]} intensity={0.8} color="#ffd9c4" />
        <directionalLight position={[3.5, 2.5, -3]} intensity={1.8} color="#8fcfff" />
        <Character />
      </Canvas>
    </div>
  );
}
