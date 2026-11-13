# Muhammad Ali — Portfolio

Personal portfolio of Muhammad Ali: full-stack engineer, AI/ML and security builder.
React + TypeScript + Vite, with GSAP for motion and Three.js (React Three Fiber) for the 3D character.

## Highlights

- **Builds itself live.** On load the page assembles itself (text types out, cards are dragged into place by a ghost cursor), then hands control to the visitor. Any scroll, key or click skips it. Honors `prefers-reduced-motion`.
- **3D cartoon character.** A hand-built, procedural Three.js version of me: glossy rounded 3D style with teal and magenta rim lights, a mustache, a backwards cap and a dark sweatshirt. The eyes track the cursor and blink, and the head turns toward it. Falls back to a tilt-parallax portrait if WebGL is unavailable.
- **Real content.** Projects, research and experience are pulled from the actual GitHub repos (`src/data.ts`).

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
npm run preview
```

## Deploy on Vercel

1. Import this repository on [vercel.com/new](https://vercel.com/new).
2. Framework preset: **Vite** (auto-detected). Build command `npm run build`, output directory `dist`.
3. Deploy. Every push to `main` redeploys.

## Structure

| Path | What it is |
|---|---|
| `src/App.tsx` | Sections: hero, about, research, projects, toolbox, journey, contact |
| `src/liveBuild.ts` | The scroll/autopilot "live build" effect |
| `src/data.ts` | Projects, skills, timeline |
| `src/components/CartoonAvatar.tsx` | The procedural 3D cartoon character |
| `src/components/PortraitTilt.tsx` | Tilt-parallax portrait (WebGL fallback) |

## Contact

[GitHub](https://github.com/Ali-prog-spec) · [LinkedIn](https://www.linkedin.com/in/muhammad-ali-7453b8324/)
