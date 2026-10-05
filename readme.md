# JARVIS 3D

An original, cinematic 3D AI interface that runs entirely in the browser.
No backend, no build step, no API keys. Drop it on GitHub Pages and it works.

> This is an original work. It is *inspired by the general idea* of a
> futuristic AI assistant but contains no Marvel assets, dialogue,
> logos, sounds, artwork, or copyrighted material of any kind.

---

## What it is

A single-page 3D experience with:

- A procedurally generated holographic AI core built with Three.js
- An abstract AI "face" (luminous eye forms, no realism, no uncanny valley)
- A visible internal state machine that the entire 3D system reacts to
- Real browser speech recognition and speech synthesis
- A local reasoning layer that shows concise, high-level status steps
- Space mode and Car mode environments
- Procedural Web Audio interface sounds (no audio files)
- Local-only memory via `localStorage`
- Adaptive performance tiers and reduced-motion support
- Full keyboard, mouse, and touch control

---

## Quick start

Open `index.html`. That's it.

For speech recognition to work you must serve over `http(s)` —
opening the file directly with `file://` will block the microphone.
Any static server works:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
