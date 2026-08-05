# ICEBERG

A scrollable 3D web CV. Instead of a static resume page, the whole site is one continuous
camera descent through a foggy monochrome glacier, where each section of my background
surfaces as a piece of the scene.

**Live:** https://nemiiceberg.vercel.app

## What it does

Scrolling drives the camera, not the page. As you scroll:

1. The camera falls through fog into the glacier.
2. Ice crystals render live and react to hover and click, each one opening a project.
3. A particle face assembles out of drifting points.
4. A portal transition moves you into the next act.
5. A chat dock lets visitors ask about my work instead of reading it.

## How it is built

The scene is real 3D, the text is not. That is a deliberate split: everything visual runs
in WebGL through React Three Fiber, while the copy and the interface sit on top as plain
HTML and CSS. Text stays selectable, accessible, and cheap to change, and the GPU only
handles what actually needs it.

Ice uses `MeshTransmissionMaterial` from drei for refraction rather than a faked
transparent shader, so crystals bend what is behind them.

## Stack

| Layer | Tool |
| --- | --- |
| Build | Vite 5 |
| UI | React 18 |
| 3D | React Three Fiber 8, drei, three 0.166 |
| Post FX | @react-three/postprocessing |
| Motion | GSAP |
| Assets | Blender, exported to GLB |
| Hosting | Vercel |

## Structure

```
src/
  Experience.jsx     scene graph and camera rig
  Glacier.jsx        environment and fog
  Crystal.jsx        interactive ice crystals
  ParticleFace.jsx   point cloud face
  Portal.jsx         act transition
  UI.jsx             HTML overlay
  scrollState.js     shared scroll progress
  chat/              chat dock
```

## Running locally

```bash
npm install
npm run dev
```

Build with `npm run build`, preview the build with `npm run preview`.

## Notes

Crystal count and post-processing passes are the two things that move the frame rate most.
If you are testing on a weak GPU, reduce those first.
