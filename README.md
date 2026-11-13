# Muhammad Ali — Portfolio

Personal portfolio of Muhammad Ali: full-stack engineer, AI/ML and security builder.
React + TypeScript + Vite, with GSAP for motion and Three.js (React Three Fiber) for the optional 3D model.

## Highlights

- **Builds itself live.** On load the page assembles itself (text types out, cards are dragged into place by a ghost cursor), then hands control to the visitor. Any scroll, key or click skips it. Honors `prefers-reduced-motion`.
- **Interactive portrait.** A cursor-responsive tilt-parallax portrait in the hero. If `public/avatar.glb` exists, the hero shows an orbitable 3D model instead.
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
| `src/components/PortraitTilt.tsx` | Tilt-parallax portrait |
| `src/components/ModelViewer.tsx` | Orbit viewer for an optional `public/avatar.glb` |

## Contact

[GitHub](https://github.com/Ali-prog-spec) · [LinkedIn](https://www.linkedin.com/in/muhammad-ali-7453b8324/)
